import { useEffect, useRef, useState, useCallback } from "react";
import { RefreshCw, Crosshair } from "lucide-react";
import stops from "@/data/stops.json";
import shapes from "@/data/shapes.json";
import { ROUTES, routeColor, routeMeta } from "@/data/routes";
import { stopSanAntonioStatus } from "@/lib/sanAntonio";
import { slugForStop } from "@/data/stop-slugs";
import { trackStopVisit } from "@/lib/favorites";
import { parseOccupancy, occupancyHtml } from "@/lib/occupancy";

interface VehicleEntity {
  id: string;
  vehicle?: {
    trip?: { tripId?: string; routeId?: string };
    position?: { latitude?: number; longitude?: number; speed?: number; bearing?: number };
    vehicle?: { id?: string; label?: string };
    timestamp?: number;
  };
}

interface FeedResponse {
  header?: { timestamp?: number };
  entity?: VehicleEntity[];
}

const ARROYO_CENTER: [number, number] = [41.6167, -4.7836];
const REFRESH_INTERVAL = 1_000;
const LIGHT_TILES = "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png";
const DARK_TILES = "https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png";

const isNight = () => {
  if (typeof document !== "undefined" && document.documentElement.classList.contains("dark")) return true;
  if (typeof window !== "undefined" && window.matchMedia?.("(prefers-color-scheme: dark)").matches) return true;
  const h = new Date().getHours();
  return h >= 21 || h < 7;
};

function busIconHtml(color: string, bearing: number | null, speedKmh: number | null) {
  const rot = bearing == null ? "" : `transform:rotate(${bearing}deg);`;
  const spd =
    speedKmh == null
      ? ""
      : `<div class="ab-bus-speed" style="background:${color}">${Math.round(speedKmh)}<span>km/h</span></div>`;
  return `<div class="ab-bus" style="--c:${color}">
    ${spd}
    <div class="ab-bus-dot" style="background:${color}">
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" style="${rot}"><path d="M8 6v6"/><path d="M16 6v6"/><path d="M2 12h20"/><path d="M18 18H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2Z"/><circle cx="7" cy="18" r="2"/><circle cx="17" cy="18" r="2"/></svg>
    </div>
  </div>`;
}

export default function BusMap() {
  const mapRef = useRef<any>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const markersRef = useRef<Map<string, any>>(new Map());
  const animsRef = useRef<Map<string, number>>(new Map());
  const iconKeysRef = useRef<Map<string, string>>(new Map());
  const stopMarkersRef = useRef<Map<string, any>>(new Map());
  const stopPopupTimers = useRef<Map<string, any>>(new Map());
  const linesRef = useRef<Map<string, any[]>>(new Map());
  const leafletRef = useRef<any>(null);
  const tileRef = useRef<any>(null);
  const userMarkerRef = useRef<any>(null);
  const activeLineRef = useRef<string | null>(null);
  const [activeLine, setActiveLine] = useState<string | null>(null);
  const [count, setCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [lastUpdate, setLastUpdate] = useState<string>("");

  // Movimiento animado entre actualizaciones
  const animateMarker = useCallback((id: string, marker: any, to: [number, number]) => {
    const L = leafletRef.current;
    if (!L) return;
    const from = marker.getLatLng();
    if (from.lat === to[0] && from.lng === to[1]) return;
    const prev = animsRef.current.get(id);
    if (prev) cancelAnimationFrame(prev);
    const start = performance.now();
    const dur = 950;
    const step = (t: number) => {
      const k = Math.min(1, (t - start) / dur);
      const e = k < 0.5 ? 2 * k * k : 1 - Math.pow(-2 * k + 2, 2) / 2;
      marker.setLatLng([from.lat + (to[0] - from.lat) * e, from.lng + (to[1] - from.lng) * e]);
      if (k < 1) animsRef.current.set(id, requestAnimationFrame(step));
      else animsRef.current.delete(id);
    };
    animsRef.current.set(id, requestAnimationFrame(step));
  }, []);

  const inFlight = useRef(false);
  const fetchVehicles = useCallback(async () => {
    if (inFlight.current) return;
    inFlight.current = true;
    try {
      const res = await fetch("/api/gtfs-rt/vehicle-positions?format=json");
      if (!res.ok) return;
      const data: FeedResponse = await res.json();
      const entities = data.entity ?? [];

      const map = mapRef.current;
      const L = leafletRef.current;
      if (!map || !L) return;

      const activeIds = new Set<string>();
      const filter = activeLineRef.current;

      for (const e of entities) {
        const pos = e.vehicle?.position;
        if (!pos?.latitude || !pos?.longitude) continue;
        const routeId = e.vehicle?.trip?.routeId || "";
        if (filter && routeMeta(routeId)?.id !== filter) continue;

        const id = e.id;
        activeIds.add(id);
        const latlng: [number, number] = [pos.latitude, pos.longitude];
        const color = routeColor(routeId);

        const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
        const label = esc(String(e.vehicle?.vehicle?.label || e.vehicle?.vehicle?.id || id));
        const meta = routeMeta(routeId);
        const route = esc(String(meta?.name || routeId || "—"));
        const speedKmh = pos.speed != null ? pos.speed * 3.6 : null;
        const speed = speedKmh != null ? `${speedKmh.toFixed(0)} km/h` : "—";

        const popupContent = `
          <div style="font-family:system-ui;font-size:13px;line-height:1.5;min-width:170px">
            <div style="display:inline-block;background:${color};color:#fff;font-weight:700;font-size:11px;padding:2px 8px;border-radius:10px;margin-bottom:4px">${route}</div>
            <div><strong>🚍 ${label}</strong></div>
            <div>Velocidad: ${speed}</div>
            ${occupancyHtml(parseOccupancy((e.vehicle as any)?.occupancyStatus, (e.vehicle as any)?.occupancyPercentage))}
            <a href="/api/buses/${encodeURIComponent(label)}" style="display:inline-block;margin-top:6px;font-size:11px;color:#1d4ed8;font-weight:600">Datos del bus →</a>
          </div>`;

        const iconKey = `${color}|${pos.bearing ?? "-"}|${speedKmh == null ? "-" : Math.round(speedKmh)}`;
        const existing = markersRef.current.get(id);
        if (existing) {
          animateMarker(id, existing, latlng);
          existing.setPopupContent(popupContent);
          // Solo recreamos el icono si cambia algo visible (evita parpadeo al refrescar cada segundo)
          if (iconKeysRef.current.get(id) !== iconKey) {
            iconKeysRef.current.set(id, iconKey);
            existing.setIcon(
              L.divIcon({ html: busIconHtml(color, pos.bearing ?? null, speedKmh), className: "", iconSize: [30, 30], iconAnchor: [15, 15], popupAnchor: [0, -22] }),
            );
          }
        } else {
          iconKeysRef.current.set(id, iconKey);
          const marker = L.marker(latlng, {
            icon: L.divIcon({ html: busIconHtml(color, pos.bearing ?? null, speedKmh), className: "", iconSize: [30, 30], iconAnchor: [15, 15], popupAnchor: [0, -22] }),
            zIndexOffset: 500,
          })
            .bindPopup(popupContent)
            .addTo(map);
          markersRef.current.set(id, marker);
        }
      }

      for (const [id, marker] of markersRef.current) {
        if (!activeIds.has(id)) {
          const el = marker.getElement?.();
          if (el) el.classList.add("ab-bus-out");
          const t = setTimeout(() => map.removeLayer(marker), 300);
          void t;
          markersRef.current.delete(id);
          iconKeysRef.current.delete(id);
        }
      }

      setCount(activeIds.size);
      setLastUpdate(new Date().toLocaleTimeString("es-ES"));
    } catch {
      // silent
    } finally {
      inFlight.current = false;
      setLoading(false);
    }
  }, [animateMarker]);

  const locateUser = useCallback(() => {
    const map = mapRef.current;
    const L = leafletRef.current;
    if (!map || !L || typeof navigator === "undefined" || !navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition(
      (p) => {
        const ll: [number, number] = [p.coords.latitude, p.coords.longitude];
        if (userMarkerRef.current) userMarkerRef.current.setLatLng(ll);
        else {
          userMarkerRef.current = L.marker(ll, {
            icon: L.divIcon({ html: `<div class="ab-user"></div>`, className: "", iconSize: [18, 18], iconAnchor: [9, 9] }),
            zIndexOffset: 900,
          }).addTo(map);
        }
        map.flyTo(ll, 15, { duration: 0.9 });
      },
      () => {},
      { enableHighAccuracy: true, timeout: 8000, maximumAge: 30000 },
    );
  }, []);

  // Filtro de línea: resalta recorridos y refresca buses
  useEffect(() => {
    activeLineRef.current = activeLine;
    for (const [id, polys] of linesRef.current) {
      for (const p of polys) {
        const dim = activeLine != null && activeLine !== id;
        p.setStyle({ opacity: dim ? 0.12 : 0.85, weight: activeLine === id ? 6 : 4 });
      }
    }
    for (const [, marker] of markersRef.current) mapRef.current?.removeLayer(marker);
    markersRef.current.clear();
    fetchVehicles();
  }, [activeLine, fetchVehicles]);

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;

    let cancelled = false;

    (async () => {
      const L = await import("leaflet");
      await import("leaflet/dist/leaflet.css");

      if (cancelled || !containerRef.current) return;

      leafletRef.current = L.default || L;
      const Leaf = leafletRef.current;

      const map = Leaf.map(containerRef.current, {
        center: ARROYO_CENTER,
        zoom: 14,
        zoomControl: true,
        zoomAnimation: true,
      });

      tileRef.current = Leaf.tileLayer(isNight() ? DARK_TILES : LIGHT_TILES, {
        attribution: isNight()
          ? '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; CARTO'
          : '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
        maxZoom: 19,
      }).addTo(map);

      mapRef.current = map;

      // --- Recorridos de línea ---
      const shapeData = shapes as unknown as Record<string, [number, number][]>;
      for (const r of ROUTES) {
        const polys: any[] = [];
        for (const sid of r.shapes) {
          const pts = shapeData[sid];
          if (!pts?.length) continue;
          const casing = Leaf.polyline(pts, { color: "#00000033", weight: 7, opacity: 0.35, interactive: false }).addTo(map);
          const line = Leaf.polyline(pts, { color: r.color, weight: 4, opacity: 0.85, lineJoin: "round" }).addTo(map);
          line.bindTooltip(r.name, { sticky: true });
          line.on("click", () => setActiveLine((cur) => (cur === r.id ? null : r.id)));
          polys.push(casing, line);
        }
        linesRef.current.set(r.id, polys);
      }

      // --- Paradas (GTFS estático) ---
      const stopIcon = Leaf.divIcon({
        html: `<div class="ab-stop"></div>`,
        className: "",
        iconSize: [14, 14],
        iconAnchor: [7, 7],
        popupAnchor: [0, -8],
      });

      const renderArrivals = async (stopId: string, stopName: string) => {
        try {
          const res = await fetch(`/api/stops/${stopId}`);
          if (!res.ok) return `<div style="font-family:system-ui;font-size:13px"><strong>${stopName}</strong><br/><span style="color:#888">Sin datos</span></div>`;
          const data = await res.json();
          const list = (data.arrivals || []) as Array<any>;
          const sa = stopSanAntonioStatus(stopId);
          let saHtml = "";
          if (sa.kind === "plaza-espana" || sa.kind === "flecha-suspended") {
            saHtml = `<div style="margin:4px 0 6px;padding:6px 8px;border-radius:8px;background:#fee2e2;color:#991b1b;font-size:11px;font-weight:600">⚠ Parada suspendida (Fiestas San Antonio)</div>`;
          } else if (sa.kind === "canazo") {
            saHtml = `<div style="margin:4px 0 6px;padding:6px 8px;border-radius:8px;background:#fef3c7;color:#92400e;font-size:11px;font-weight:600">★ Única parada activa en La Flecha (10–14 jun)</div>`;
          } else if (sa.kind === "buho-fiestas") {
            saHtml = `<div style="margin:4px 0 6px;padding:6px 8px;border-radius:8px;background:#e0e7ff;color:#3730a3;font-size:11px;font-weight:600">🌙 Salida Búho Fiestas (gratuito, 10–13 jun)</div>`;
          }
          const slug = slugForStop(stopId);
          const linkHtml = slug
            ? `<a href="/parada/${slug}" style="display:inline-block;margin-top:6px;padding:4px 8px;background:#1d4ed8;color:#fff;font-size:11px;font-weight:600;border-radius:6px;text-decoration:none">Abrir parada →</a>`
            : "";
          const rows = list.length
            ? list.map((a) => {
                const color = routeColor(a.routeId, a.routeColor ? `#${a.routeColor}` : undefined);
                const short = (routeMeta(a.routeId)?.name || a.routeShortName || a.routeName || "—").toString();
                const head = (a.tripHeadsign || "").toString();
                const time = new Date(a.estimatedArrival * 1000).toLocaleTimeString("es-ES", { hour: "2-digit", minute: "2-digit" });
                const min = a.isScheduled ? time : a.minutesAway === 0 ? "Ahora" : `${a.minutesAway} min`;
                const pct = Math.max(4, Math.min(100, ((15 - Math.min(a.minutesAway ?? 15, 15)) / 15) * 100));
                const badge = a.isScheduled
                  ? `<span title="Llegada según horario" style="display:inline-flex;align-items:center;gap:3px;background:#f59e0b22;color:#b45309;font-size:10px;font-weight:600;padding:2px 6px;border-radius:8px;white-space:nowrap">⏱ Horario</span>`
                  : `<span title="Datos en tiempo real" style="display:inline-flex;align-items:center;gap:3px;background:#10b98122;color:#047857;font-size:10px;font-weight:600;padding:2px 6px;border-radius:8px;white-space:nowrap"><span style="display:inline-block;width:6px;height:6px;border-radius:50%;background:#10b981"></span>En vivo</span>`;
                return `<tr>
                  <td style="padding:4px 6px"><span style="display:inline-block;background:${color};color:#fff;font-weight:600;font-size:11px;padding:2px 7px;border-radius:10px">${short}</span></td>
                  <td style="padding:4px 6px;color:#444;font-size:12px">${head}<div style="margin-top:2px">${badge}</div>
                    <div style="margin-top:4px;height:4px;border-radius:4px;background:#e5e7eb;overflow:hidden"><div style="height:100%;width:${pct}%;background:${color};transition:width .8s ease"></div></div>
                  </td>
                  <td style="padding:4px 6px;text-align:right;font-weight:700;font-size:12px;color:${color}">${min}</td>
                </tr>`;
              }).join("")
            : `<tr><td colspan="3" style="padding:8px;color:#888;font-size:12px;text-align:center">Sin llegadas próximas</td></tr>`;
          return `<div style="font-family:system-ui;min-width:250px">
            <div style="font-weight:600;font-size:13px;margin-bottom:6px">${stopName}</div>
            <div style="font-size:11px;color:#888;margin-bottom:4px">Parada ${stopId}</div>
            ${saHtml}
            <table style="border-collapse:collapse;width:100%">${rows}</table>
            <div style="margin-top:6px;font-size:10px;color:#888;display:flex;gap:8px">
              <span><span style="display:inline-block;width:6px;height:6px;border-radius:50%;background:#10b981;vertical-align:middle"></span> En vivo (GPS)</span>
              <span><span style="vertical-align:middle">⏱</span> Horario</span>
            </div>
            ${linkHtml}
          </div>`;
        } catch {
          return `<div style="font-family:system-ui;font-size:13px"><strong>${stopName}</strong><br/><span style="color:#888">Error</span></div>`;
        }
      };

      for (const s of stops as Array<{ id: string; name: string; lat: number; lon: number }>) {
        const m = Leaf.marker([s.lat, s.lon], { icon: stopIcon }).addTo(map);
        m.bindPopup(`<div style="font-family:system-ui;font-size:13px"><strong>${s.name}</strong><br/><span style="color:#888">Cargando llegadas…</span></div>`);
        m.on("popupopen", async () => {
          trackStopVisit(s.id);
          const html = await renderArrivals(s.id, s.name);
          m.setPopupContent(html);
          const t = setInterval(async () => {
            const h = await renderArrivals(s.id, s.name);
            m.setPopupContent(h);
          }, 15000);
          stopPopupTimers.current.set(s.id, t);
        });
        m.on("popupclose", () => {
          const t = stopPopupTimers.current.get(s.id);
          if (t) { clearInterval(t); stopPopupTimers.current.delete(s.id); }
        });
        stopMarkersRef.current.set(s.id, m);
      }

      fetchVehicles();
    })();

    const interval = setInterval(fetchVehicles, REFRESH_INTERVAL);
    return () => {
      cancelled = true;
      clearInterval(interval);
      for (const t of stopPopupTimers.current.values()) clearInterval(t);
      for (const a of animsRef.current.values()) cancelAnimationFrame(a);
      stopPopupTimers.current.clear();
      animsRef.current.clear();
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
      }
      markersRef.current.clear();
      stopMarkersRef.current.clear();
      linesRef.current.clear();
    };
  }, [fetchVehicles]);

  const activeMeta = ROUTES.find((r) => r.id === activeLine);

  return (
    <div
      className="rounded-2xl overflow-hidden glass transition-shadow"
      style={activeMeta ? { boxShadow: `0 12px 40px -18px ${activeMeta.color}` } : undefined}
    >
      <div className="flex items-center justify-between gap-2 px-4 py-3 border-b border-border">
        <div className="flex items-center gap-2">
          <div className="w-2.5 h-2.5 rounded-full bg-green-500 animate-pulse" />
          <span className="text-sm font-medium">
            {loading ? "Cargando…" : `${count} bus${count !== 1 ? "es" : ""} activo${count !== 1 ? "s" : ""}`}
          </span>
        </div>
        <div className="flex items-center gap-2">
          {lastUpdate && <span className="hidden sm:inline text-xs text-muted-foreground">Actualizado: {lastUpdate}</span>}
          <button onClick={locateUser} className="p-1.5 rounded-md hover:bg-accent transition-colors" title="Mi ubicación" aria-label="Centrar en mi ubicación">
            <Crosshair className="w-3.5 h-3.5 text-muted-foreground" />
          </button>
          <button onClick={fetchVehicles} className="p-1.5 rounded-md hover:bg-accent transition-colors group" title="Actualizar" aria-label="Actualizar posiciones de los autobuses">
            <RefreshCw className={`w-3.5 h-3.5 text-muted-foreground ${loading ? "animate-spin" : "group-active:animate-spin"}`} />
          </button>
        </div>
      </div>

      {/* Filtro por línea */}
      <div className="flex gap-2 overflow-x-auto px-3 py-2 border-b border-border">
        <button
          onClick={() => setActiveLine(null)}
          className={`px-3 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap transition-all ${activeLine === null ? "bg-foreground text-background" : "bg-muted text-muted-foreground hover:bg-accent"}`}
        >
          Todas
        </button>
        {ROUTES.map((r) => (
          <button
            key={r.id}
            onClick={() => setActiveLine((cur) => (cur === r.id ? null : r.id))}
            className="px-3 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap transition-all hover:scale-[1.04]"
            style={
              activeLine === r.id
                ? { backgroundColor: r.color, color: "#fff", boxShadow: `0 4px 14px -4px ${r.color}` }
                : { backgroundColor: `${r.color}1f`, color: r.color }
            }
          >
            {r.emoji} {r.name.replace("Línea ", "")}
          </button>
        ))}
      </div>

      <div ref={containerRef} className="h-[440px] w-full" />
    </div>
  );
}
