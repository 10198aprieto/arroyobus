import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "@tanstack/react-router";
import { MapPin, Star, ChevronRight, RefreshCw, Sparkles, Moon, Sun } from "lucide-react";
import stopsData from "@/data/stops.json";
import { slugForStop } from "@/data/stop-slugs";
import { routeColor, routeMeta } from "@/data/routes";
import { loadPlaces, suggestedStop, lastStop, type FavoritePlace, togglePlace } from "@/lib/favorites";
import TripPlanner from "@/components/TripPlanner";
import PushToggle from "@/components/PushToggle";
import PassengerReport from "@/components/PassengerReport";


interface Stop { id: string; name: string; desc: string; lat: number; lon: number }
interface Arrival {
  routeId: string;
  routeShortName?: string;
  routeName?: string;
  tripHeadsign?: string;
  estimatedArrival: number;
  minutesAway: number;
  isScheduled?: boolean;
}

const stops = stopsData as Stop[];

function greeting(d = new Date()) {
  const h = d.getHours();
  if (h < 6) return "Buenas noches";
  if (h < 14) return "Buenos días";
  if (h < 21) return "Buenas tardes";
  return "Buenas noches";
}

function distance(a: { lat: number; lon: number }, b: { lat: number; lon: number }) {
  const R = 6371000;
  const toRad = (x: number) => (x * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLon = toRad(b.lon - a.lon);
  const s =
    Math.sin(dLat / 2) ** 2 +
    Math.sin(dLon / 2) ** 2 * Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat));
  return 2 * R * Math.asin(Math.sqrt(s));
}

function useArrivals(stopId: string | null) {
  const [arrivals, setArrivals] = useState<Arrival[] | null>(null);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    if (!stopId) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/stops/${stopId}`);
      if (res.ok) {
        const data = await res.json();
        setArrivals((data.arrivals ?? []) as Arrival[]);
      }
    } catch {
      /* silencio */
    } finally {
      setLoading(false);
    }
  }, [stopId]);

  useEffect(() => {
    setArrivals(null);
    load();
    const id = setInterval(load, 20_000);
    return () => clearInterval(id);
  }, [load]);

  return { arrivals, loading, reload: load };
}

/** Barra de progreso de llegada: llena conforme el bus se acerca (ventana 15 min). */
function ArrivalBar({ minutes, color }: { minutes: number; color: string }) {
  const pct = Math.max(4, Math.min(100, ((15 - Math.min(minutes, 15)) / 15) * 100));
  return (
    <div className="h-1.5 w-full rounded-full bg-muted overflow-hidden">
      <div
        className="h-full rounded-full transition-[width] duration-1000 ease-out"
        style={{ width: `${pct}%`, backgroundColor: color }}
      />
    </div>
  );
}

function ArrivalRow({ a }: { a: Arrival }) {
  const meta = routeMeta(a.routeId);
  const color = routeColor(a.routeId);
  const label = meta?.name ?? a.routeShortName ?? a.routeId;
  const time = new Date(a.estimatedArrival * 1000).toLocaleTimeString("es-ES", { hour: "2-digit", minute: "2-digit" });
  return (
    <div className="py-3 first:pt-0 last:pb-0 animate-fade-in">
      <div className="flex items-center gap-3">
        <span
          className="w-2.5 h-2.5 rounded-full flex-shrink-0"
          style={{ backgroundColor: color, boxShadow: `0 0 0 4px ${color}22` }}
        />
        <div className="min-w-0 flex-1">
          <div className="text-sm font-semibold truncate">
            {label}
            {a.tripHeadsign ? <span className="text-muted-foreground font-normal"> · {a.tripHeadsign}</span> : null}
          </div>
          <div className="text-[11px] text-muted-foreground tabular-nums">
            {time} · {a.isScheduled ? "Horario" : "En vivo"}
          </div>
        </div>
        <div className="text-right">
          <div className="text-xl font-bold tabular-nums leading-none" style={{ color }}>
            {a.minutesAway <= 0 ? "Ya" : a.minutesAway}
          </div>
          <div className="text-[10px] text-muted-foreground uppercase tracking-wide">
            {a.minutesAway <= 0 ? "llega" : "min"}
          </div>
        </div>
      </div>
      <div className="mt-2 pl-6">
        <ArrivalBar minutes={a.minutesAway} color={color} />
      </div>
    </div>
  );
}

function FavoriteCard({ place, onRemove }: { place: FavoritePlace; onRemove: (id: string) => void }) {
  const { arrivals } = useArrivals(place.stopId);
  const next = arrivals?.[0];
  const color = routeColor(next?.routeId);
  const slug = slugForStop(place.stopId);
  const inner = (
    <div className="ios-press glass rounded-2xl p-4 h-full hover:-translate-y-0.5 hover:shadow-lg transition-all">
      <div className="flex items-start justify-between gap-2">
        <span className="text-2xl leading-none">{place.emoji}</span>
        <button
          onClick={(e) => { e.preventDefault(); e.stopPropagation(); onRemove(place.stopId); }}
          className="text-[10px] text-muted-foreground hover:text-destructive transition-colors"
          aria-label={`Quitar ${place.label} de tus lugares`}
        >
          Quitar
        </button>
      </div>
      <div className="mt-2 text-sm font-semibold truncate">{place.label}</div>
      <div className="mt-1 flex items-baseline gap-1.5">
        <span className="text-2xl font-bold tabular-nums" style={{ color }}>
          {next ? (next.minutesAway <= 0 ? "Ya" : next.minutesAway) : "—"}
        </span>
        {next && next.minutesAway > 0 && <span className="text-xs text-muted-foreground">min</span>}
      </div>
      {next && <div className="mt-2"><ArrivalBar minutes={next.minutesAway} color={color} /></div>}
    </div>
  );
  return slug ? <Link to="/parada/$slug" params={{ slug }}>{inner}</Link> : inner;
}

export default function Dashboard() {

  const [userPos, setUserPos] = useState<{ lat: number; lon: number } | null>(null);
  const [places, setPlaces] = useState<FavoritePlace[]>([]);
  const [suggested, setSuggested] = useState<string | null>(null);
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    setPlaces(loadPlaces());
    setSuggested(suggestedStop() ?? lastStop());
    const onFav = () => setPlaces(loadPlaces());
    window.addEventListener("arroyobus:favorites", onFav);
    const t = setInterval(() => setNow(new Date()), 60_000);
    return () => { window.removeEventListener("arroyobus:favorites", onFav); clearInterval(t); };
  }, []);

  useEffect(() => {
    if (typeof navigator === "undefined" || !navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition(
      (p) => setUserPos({ lat: p.coords.latitude, lon: p.coords.longitude }),
      () => {},
      { enableHighAccuracy: false, timeout: 6000, maximumAge: 120000 },
    );
  }, []);

  const nearest = useMemo(() => {
    if (suggested) {
      const s = stops.find((x) => x.id === suggested);
      if (s) return s;
    }
    if (!userPos) return stops.find((s) => s.id === "30") ?? stops[0];
    return [...stops].sort((a, b) => distance(userPos, a) - distance(userPos, b))[0];
  }, [userPos, suggested]);

  const { arrivals, loading, reload } = useArrivals(nearest?.id ?? null);

  const night = now.getHours() >= 21 || now.getHours() < 7;


  const addNearestAsPlace = () => {
    if (!nearest) return;
    setPlaces(togglePlace({ stopId: nearest.id, label: nearest.name, emoji: "⭐" }));
  };

  return (
    <section aria-label="Panel personal" className="space-y-6">
      {/* Saludo */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-3xl sm:text-4xl font-black tracking-tight">
            {greeting(now)} <span className="inline-block animate-fade-in">👋</span>
          </h2>
          <p className="mt-1 inline-flex items-center gap-1.5 text-sm text-muted-foreground">
            <MapPin className="w-3.5 h-3.5" /> Arroyo de la Encomienda
          </p>
        </div>
        <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full glass text-xs font-medium">
          {night ? <Moon className="w-3.5 h-3.5" /> : <Sun className="w-3.5 h-3.5" />}
          {night ? "Modo noche" : now.toLocaleTimeString("es-ES", { hour: "2-digit", minute: "2-digit" })}
        </span>
      </div>

      {/* Planificador de viaje */}
      <TripPlanner />
      <PushToggle />
      <PassengerReport />


      {/* Próximos buses */}
      <div className="glass rounded-2xl p-5">
        <div className="flex items-center justify-between gap-3 mb-3">
          <div className="min-w-0">
            <h3 className="text-sm font-semibold flex items-center gap-1.5">
              Tus próximos buses
              {suggested && <Sparkles className="w-3.5 h-3.5 text-primary" aria-label="Sugerido por tus hábitos" />}
            </h3>
            <p className="text-[11px] text-muted-foreground truncate">
              {nearest ? `${nearest.name} · parada ${nearest.id}` : "Buscando parada…"}
            </p>
          </div>
          <div className="flex items-center gap-1">
            <button
              onClick={addNearestAsPlace}
              className="p-2 rounded-xl hover:bg-accent transition-colors"
              aria-label="Guardar esta parada en tus lugares"
            >
              <Star className="w-4 h-4 text-muted-foreground" />
            </button>
            <button
              onClick={reload}
              className="p-2 rounded-xl hover:bg-accent transition-colors"
              aria-label="Actualizar llegadas"
            >
              <RefreshCw className={`w-4 h-4 text-muted-foreground ${loading ? "animate-spin" : ""}`} />
            </button>
          </div>
        </div>

        {arrivals === null ? (
          <div className="space-y-3">
            {[0, 1].map((i) => <div key={i} className="h-12 rounded-xl bg-muted animate-pulse" />)}
          </div>
        ) : arrivals.length === 0 ? (
          <p className="text-sm text-muted-foreground py-3">Sin llegadas próximas en esta parada.</p>
        ) : (
          <div className="divide-y divide-border">
            {arrivals.slice(0, 3).map((a, i) => <ArrivalRow key={`${a.routeId}-${a.estimatedArrival}-${i}`} a={a} />)}
          </div>
        )}

        {nearest && slugForStop(nearest.id) && (
          <Link
            to="/parada/$slug"
            params={{ slug: slugForStop(nearest.id)! }}
            className="mt-3 inline-flex items-center gap-1 text-xs font-semibold text-primary hover:gap-2 transition-all"
          >
            Ver parada completa <ChevronRight className="w-3.5 h-3.5" />
          </Link>
        )}
      </div>

      {/* Tus lugares */}
      <div>
        <h3 className="text-sm font-semibold mb-3 flex items-center gap-1.5">
          <Star className="w-4 h-4 text-amber-500" /> Tus lugares
        </h3>
        {places.length === 0 ? (
          <div className="glass rounded-2xl p-4 text-sm text-muted-foreground">
            Guarda tus paradas favoritas con la estrella ⭐ y aparecerán aquí con los minutos del próximo bus.
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {places.map((p) => (
              <FavoriteCard
                key={p.stopId}
                place={p}
                onRemove={(id) => setPlaces(togglePlace({ stopId: id, label: p.label, emoji: p.emoji }))}
              />
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
