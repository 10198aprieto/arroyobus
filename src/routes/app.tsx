import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Bus, Search, MapPin, RefreshCw, ArrowLeft, Map as MapIcon, CreditCard, Plus, Trash2, X, Pencil, ScanLine, Camera, Radio, CalendarClock, ChevronRight, WifiOff, LocateFixed } from "lucide-react";
import QRCode from "qrcode";
import stopsData from "@/data/stops.json";
import { loadCards, addCard, removeCard, updateCard, type BuscylCard } from "@/lib/buscyl-cards";
import SanAntonioBanner from "@/components/SanAntonioBanner";
import StopSanAntonioNotice from "@/components/StopSanAntonioNotice";
import StopScheduleViewer from "@/components/StopScheduleViewer";
import { slugForStop } from "@/data/stop-slugs";
import { stopSanAntonioStatus } from "@/lib/sanAntonio";
import { ExternalLink } from "lucide-react";
import { useIsIOS, haptic } from "@/hooks/use-platform";

interface Stop { id: string; name: string; desc: string; lat: number; lon: number }
interface Arrival {
  tripId: string;
  vehicleId: string;
  routeId: string;
  routeName: string;
  routeShortName?: string;
  routeColor?: string;
  tripHeadsign?: string;
  estimatedArrival: number;
  minutesAway: number;
  isEstimated?: boolean;
  isScheduled?: boolean;
}

type AppSearch = { parada?: string; tab?: "stops" | "cards" };

export const Route = createFileRoute("/app")({
  validateSearch: (s: Record<string, unknown>): AppSearch => ({
    parada: typeof s.parada === "string" || typeof s.parada === "number" ? String(s.parada) : undefined,
    tab: s.tab === "cards" ? "cards" : undefined,
  }),
  component: AppPage,
  head: () => ({
    meta: [
      { title: "ArroyoBus — Próximas llegadas" },
      { name: "description", content: "Consulta las próximas llegadas de los autobuses de Arroyo de la Encomienda en tiempo real desde el móvil." },
      { name: "viewport", content: "width=device-width, initial-scale=1, viewport-fit=cover" },
      { name: "theme-color", content: "#1d4ed8" },
      { property: "og:title", content: "ArroyoBus — Próximas llegadas" },
      { property: "og:description", content: "Consulta las próximas llegadas de los autobuses de Arroyo de la Encomienda en tiempo real." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
});

const stops = stopsData as Stop[];
const norm = (s: string) => s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
const fmtDist = (d: number) => (d < 1000 ? `${Math.round(d)} m` : `${(d / 1000).toFixed(1)} km`);

// Distancia haversine en metros
function distance(a: { lat: number; lon: number }, b: { lat: number; lon: number }) {
  const R = 6371000;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLon = toRad(b.lon - a.lon);
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);
  const x =
    Math.sin(dLat / 2) ** 2 +
    Math.sin(dLon / 2) ** 2 * Math.cos(lat1) * Math.cos(lat2);
  return 2 * R * Math.asin(Math.sqrt(x));
}

type GeoState = "idle" | "locating" | "ok" | "denied" | "unavailable";

function AppPage() {
  const search = Route.useSearch();
  const navigate = useNavigate({ from: "/app" });
  const [query, setQuery] = useState("");
  const [userPos, setUserPos] = useState<{ lat: number; lon: number } | null>(null);
  const [geo, setGeo] = useState<GeoState>("idle");
  const tab = search.tab ?? "stops";
  const selected = useMemo(() => stops.find((s) => s.id === search.parada) ?? null, [search.parada]);
  const isIOS = useIsIOS();

  const locate = useCallback(() => {
    if (typeof navigator === "undefined" || !navigator.geolocation) { setGeo("unavailable"); return; }
    setGeo("locating");
    navigator.geolocation.getCurrentPosition(
      (p) => { setUserPos({ lat: p.coords.latitude, lon: p.coords.longitude }); setGeo("ok"); },
      (e) => setGeo(e.code === 1 ? "denied" : "unavailable"),
      { enableHighAccuracy: false, timeout: 8000, maximumAge: 60000 }
    );
  }, []);

  useEffect(() => { locate(); }, [locate]);

  const setTab = (t: "stops" | "cards") => navigate({ search: { tab: t === "cards" ? "cards" : undefined } });
  const openStop = (s: Stop) => { haptic(); navigate({ search: { parada: s.id } }); };

  const filtered = useMemo(() => {
    const q = norm(query.trim());
    let list = stops;
    if (q) {
      list = list.filter((s) => s.id === q || norm(s.name).includes(q) || norm(s.desc).includes(q));
    }
    return userPos
      ? [...list].sort((a, b) => distance(userPos, a) - distance(userPos, b))
      : [...list].sort((a, b) => Number(a.id) - Number(b.id));
  }, [query, userPos]);

  if (selected) {
    return <StopDetail stop={selected} onBack={() => (window.history.length > 1 ? window.history.back() : navigate({ search: {} }))} userPos={userPos} />;
  }

  const navBtn = (active: boolean) =>
    `min-h-12 rounded-2xl py-2 text-xs font-semibold flex flex-col items-center justify-center gap-0.5 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${active ? "text-primary bg-primary/10" : "text-muted-foreground hover:text-foreground"}`;

  return (
    <div className="min-h-dvh bg-background text-foreground flex flex-col" style={{ paddingBottom: "env(safe-area-inset-bottom)" }}>
      <a href="#contenido" className="sr-only focus:not-sr-only focus:absolute focus:z-50 focus:m-2 focus:rounded-lg focus:bg-primary focus:px-3 focus:py-2 focus:text-primary-foreground">
        Saltar al contenido
      </a>
      <header className="sticky top-0 z-10 glass-strong border-x-0 border-t-0 overflow-hidden" style={{ paddingTop: "env(safe-area-inset-top)" }}>
        <div className="absolute inset-0 -z-10 bg-gradient-to-br from-primary/15 via-transparent to-emerald-500/10" aria-hidden="true" />
        <div className="mx-auto max-w-2xl px-4 pt-3 pb-2 flex items-center gap-2.5">
          <span className="w-10 h-10 rounded-2xl bg-primary text-primary-foreground grid place-items-center shadow-lg shadow-primary/30" aria-hidden="true">
            <Bus className="w-5 h-5" />
          </span>
          <div className="min-w-0">
            <h1 className="text-xl font-black tracking-tight leading-none">ArroyoBus</h1>
            <p className="text-xs text-muted-foreground leading-tight mt-1">
              {tab === "stops" ? `${stops.length} paradas · tiempo real` : "Tus tarjetas Buscyl"}
            </p>
          </div>
          <Link to="/" className="ml-auto min-h-11 inline-flex items-center px-3 rounded-full text-sm font-semibold text-primary hover:bg-primary/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
            Ir a la web
          </Link>
        </div>
        {tab === "stops" && <div className="mx-auto max-w-2xl px-4 pb-3">
          <label htmlFor="app-stop-search" className="sr-only">Buscar parada</label>
          <div className="relative">
            <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
            <input
              id="app-stop-search"
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Buscar parada por nombre o número…"
              className="w-full pl-10 pr-10 py-3 rounded-2xl glass text-base shadow-sm focus:outline-none focus:ring-2 focus:ring-ring transition-shadow"
              inputMode="search"
              autoComplete="off"
            />
            {query && (
              <button onClick={() => setQuery("")} className="absolute right-1.5 top-1/2 -translate-y-1/2 w-9 h-9 grid place-items-center rounded-full text-muted-foreground hover:bg-accent" aria-label="Borrar búsqueda">
                <X className="w-4 h-4" />
              </button>
            )}
          </div>
          <div className="mt-2 flex items-center justify-between gap-2 text-xs text-muted-foreground" aria-live="polite">
            <span className="flex items-center gap-1">
              <MapPin className="w-3.5 h-3.5" aria-hidden="true" />
              {geo === "ok" ? "Ordenadas por cercanía" : geo === "locating" ? "Buscando tu ubicación…" : geo === "denied" ? "Sin permiso de ubicación · orden por número" : "Orden por número"}
            </span>
            {geo !== "ok" && geo !== "locating" && (
              <button onClick={locate} className="min-h-9 inline-flex items-center gap-1 px-2.5 rounded-full font-semibold text-primary hover:bg-primary/10">
                <LocateFixed className="w-3.5 h-3.5" aria-hidden="true" /> Usar mi ubicación
              </button>
            )}
          </div>
        </div>}
      </header>

      <main id="contenido" className={`flex-1 w-full mx-auto max-w-2xl ${isIOS ? "pb-28" : ""}`}>
      {tab === "stops" ? (
        <>
          <div className="px-3 py-3"><SanAntonioBanner compact /></div>
          <p className="sr-only" aria-live="polite">{filtered.length} paradas encontradas</p>
          <ul className="divide-y divide-border" aria-label="Paradas">
            {filtered.map((s) => {
              const dist = userPos ? distance(userPos, s) : null;
              const sa = stopSanAntonioStatus(s.id);
              return (
                <li key={s.id}>
                  <button
                    onClick={() => openStop(s)}
                    className="ios-press w-full text-left px-4 py-3.5 flex items-center gap-3 hover:bg-accent/50 active:bg-accent transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring"
                    aria-label={`Parada ${s.id}, ${s.name}${dist != null ? `, a ${fmtDist(dist)}` : ""}`}
                  >
                    <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-primary to-primary/70 text-primary-foreground flex items-center justify-center text-sm font-bold shrink-0 shadow-md shadow-primary/20" aria-hidden="true">
                      {s.id}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-[15px] font-semibold truncate">{s.name}</p>
                      <p className="text-sm text-muted-foreground truncate">{s.desc}</p>
                      {sa.kind !== "none" && (
                        <p className={`text-xs font-semibold mt-0.5 inline-flex items-center gap-1 ${
                          sa.kind === "plaza-espana" || sa.kind === "flecha-suspended"
                            ? "text-destructive"
                            : "text-amber-700 dark:text-amber-400"
                        }`}>
                          {sa.kind === "plaza-espana" || sa.kind === "flecha-suspended" ? "⚠ Suspendida" : sa.kind === "buho-fiestas" ? "🌙 Búho Fiestas" : "★ Hub La Flecha"}
                        </p>
                      )}
                    </div>
                    {dist != null && (
                      <span className="text-xs font-semibold tabular-nums shrink-0 px-2 py-1 rounded-full bg-muted text-muted-foreground" aria-hidden="true">
                        {fmtDist(dist)}
                      </span>
                    )}
                    <ChevronRight className="w-4 h-4 text-muted-foreground shrink-0" aria-hidden="true" />
                  </button>
                </li>
              );
            })}
          </ul>
          {filtered.length === 0 && (
            <div className="px-4 py-10 text-center text-sm text-muted-foreground">
              <p>No hay paradas que coincidan con «{query}».</p>
              <button onClick={() => setQuery("")} className="mt-3 min-h-11 px-4 rounded-full bg-primary/10 text-primary font-semibold">Ver todas</button>
            </div>
          )}
        </>
      ) : <CardsView />}
      </main>

      {isIOS ? (
        <nav
          className="fixed inset-x-0 z-20 px-6 pointer-events-none"
          style={{ bottom: "calc(0.75rem + env(safe-area-inset-bottom))" }}
          aria-label="Navegación principal"
        >
          <div className="ios-dock glass-strong pointer-events-auto mx-auto max-w-sm grid grid-cols-3 gap-1 p-1.5">
            <button onClick={() => { haptic(); setTab("stops"); }} aria-current={tab === "stops" ? "page" : undefined} className={navBtn(tab === "stops")}>
              <Bus className="w-5 h-5" aria-hidden="true" /> Paradas
            </button>
            <button onClick={() => { haptic(); setTab("cards"); }} aria-current={tab === "cards" ? "page" : undefined} className={navBtn(tab === "cards")}>
              <CreditCard className="w-5 h-5" aria-hidden="true" /> Buscyl
            </button>
            <Link to="/" className={navBtn(false)}>
              <MapIcon className="w-5 h-5" aria-hidden="true" /> Mapa
            </Link>
          </div>
        </nav>
      ) : (
        <nav className="sticky bottom-0 border-t border-border bg-background/90 backdrop-blur-xl" aria-label="Navegación principal">
          <div className="mx-auto max-w-2xl grid grid-cols-3 gap-1 p-1.5">
            <button onClick={() => setTab("stops")} aria-current={tab === "stops" ? "page" : undefined} className={navBtn(tab === "stops")}>
              <Bus className="w-5 h-5" aria-hidden="true" /> Paradas
            </button>
            <button onClick={() => setTab("cards")} aria-current={tab === "cards" ? "page" : undefined} className={navBtn(tab === "cards")}>
              <CreditCard className="w-5 h-5" aria-hidden="true" /> Buscyl
            </button>
            <Link to="/" className={navBtn(false)}>
              <MapIcon className="w-5 h-5" aria-hidden="true" /> Mapa
            </Link>
          </div>
        </nav>
      )}
    </div>
  );
}

async function fetchArrivals(stopId: string, signal: AbortSignal): Promise<Arrival[]> {
  let lastErr: unknown;
  for (let attempt = 0; attempt < 3; attempt++) {
    const ctrl = new AbortController();
    const onAbort = () => ctrl.abort();
    signal.addEventListener("abort", onAbort);
    const t = setTimeout(() => ctrl.abort(), 10000);
    try {
      const res = await fetch(`/api/stops/${encodeURIComponent(stopId)}`, { signal: ctrl.signal, cache: "no-store" });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json();
      return Array.isArray(json?.arrivals) ? json.arrivals : [];
    } catch (e) {
      lastErr = e;
      if (signal.aborted) throw e;
      await new Promise((r) => setTimeout(r, 700 * (attempt + 1)));
    } finally {
      clearTimeout(t);
      signal.removeEventListener("abort", onAbort);
    }
  }
  throw lastErr;
}

function StopDetail({ stop, onBack, userPos }: { stop: Stop; onBack: () => void; userPos: { lat: number; lon: number } | null }) {
  const [arrivals, setArrivals] = useState<Arrival[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [updatedAt, setUpdatedAt] = useState<number | null>(null);
  const [now, setNow] = useState(() => Date.now());
  const inflight = useRef<AbortController | null>(null);
  const headingRef = useRef<HTMLHeadingElement | null>(null);

  const load = useCallback(async () => {
    inflight.current?.abort();
    const ctrl = new AbortController();
    inflight.current = ctrl;
    setLoading(true);
    try {
      const list = await fetchArrivals(stop.id, ctrl.signal);
      if (ctrl.signal.aborted) return;
      setArrivals(list.sort((a, b) => a.estimatedArrival - b.estimatedArrival));
      setUpdatedAt(Date.now());
      setError(false);
    } catch {
      if (!ctrl.signal.aborted) setError(true);
    } finally {
      if (inflight.current === ctrl) setLoading(false);
    }
  }, [stop.id]);

  useEffect(() => {
    setArrivals(null);
    setError(false);
    headingRef.current?.focus();
    load();
    const i = setInterval(() => { if (document.visibilityState === "visible" && navigator.onLine !== false) load(); }, 15000);
    const tick = setInterval(() => setNow(Date.now()), 5000);
    const onVis = () => { if (document.visibilityState === "visible") load(); };
    document.addEventListener("visibilitychange", onVis);
    window.addEventListener("online", load);
    return () => {
      clearInterval(i);
      clearInterval(tick);
      document.removeEventListener("visibilitychange", onVis);
      window.removeEventListener("online", load);
      inflight.current?.abort();
    };
  }, [load]);

  const dist = userPos ? distance(userPos, stop) : null;
  const ageSec = updatedAt ? Math.max(0, Math.round((now - updatedAt) / 1000)) : null;
  const stale = ageSec != null && ageSec > 60;
  const slug = slugForStop(stop.id);

  return (
    <div className="min-h-dvh bg-background text-foreground flex flex-col" style={{ paddingBottom: "env(safe-area-inset-bottom)" }}>
      <header className="sticky top-0 z-10 glass-strong border-x-0 border-t-0" style={{ paddingTop: "env(safe-area-inset-top)" }}>
        <div className="mx-auto max-w-2xl px-2 py-2 flex items-center gap-1">
          <button onClick={onBack} className="w-11 h-11 grid place-items-center rounded-full hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" aria-label="Volver a la lista de paradas">
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div className="min-w-0 flex-1">
            <p className="text-xs text-muted-foreground truncate">Parada {stop.id} · {stop.desc}</p>
            <h2 ref={headingRef} tabIndex={-1} className="text-base font-bold truncate focus:outline-none">{stop.name}</h2>
          </div>
          <button onClick={load} disabled={loading} className="w-11 h-11 grid place-items-center rounded-full hover:bg-accent disabled:opacity-60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" aria-label="Actualizar llegadas">
            <RefreshCw className={`w-5 h-5 ${loading ? "animate-spin" : ""}`} />
          </button>
        </div>
      </header>

      <main className="flex-1 w-full mx-auto max-w-2xl">
        <div className="px-4 py-2 text-xs text-muted-foreground flex items-center justify-between" aria-live="polite">
          <span className={stale ? "text-amber-700 dark:text-amber-400 font-semibold" : ""}>
            {ageSec == null ? (loading ? "Cargando…" : "") : ageSec < 10 ? "Actualizado ahora" : `Actualizado hace ${ageSec < 60 ? `${ageSec} s` : `${Math.round(ageSec / 60)} min`}`}
          </span>
          {dist != null && <span>A {fmtDist(dist)} de ti</span>}
        </div>

        {error && (
          <div role="alert" className="mx-3 mb-2 p-3 rounded-2xl border border-destructive/30 bg-destructive/10 flex items-center gap-3">
            <WifiOff className="w-5 h-5 text-destructive shrink-0" aria-hidden="true" />
            <p className="text-sm flex-1">
              {arrivals ? "No se pudo actualizar. Mostrando los últimos datos." : "No se pudieron cargar las llegadas. Comprueba tu conexión."}
            </p>
            <button onClick={load} className="min-h-10 px-3 rounded-full bg-destructive text-destructive-foreground text-sm font-semibold">Reintentar</button>
          </div>
        )}

        <div className="px-3 space-y-2">
          <StopSanAntonioNotice stopId={stop.id} compact />
          {slug && (
            <Link
              to="/parada/$slug"
              params={{ slug }}
              className="flex items-center justify-center gap-1.5 min-h-11 px-3 rounded-2xl bg-primary/10 text-primary text-sm font-semibold hover:bg-primary/20"
            >
              <ExternalLink className="w-4 h-4" aria-hidden="true" />
              Ubicación, Street View y horario
            </Link>
          )}
        </div>

        <section aria-label="Próximas llegadas" aria-busy={loading && !arrivals} className="mt-2">
          {loading && !arrivals && !error && (
            <ul className="px-4 space-y-3 py-2" aria-hidden="true">
              {[0, 1, 2].map((i) => <li key={i} className="h-14 rounded-2xl bg-muted animate-pulse" />)}
            </ul>
          )}
          {arrivals && arrivals.length === 0 && (
            <p className="px-4 py-10 text-center text-sm text-muted-foreground">No hay llegadas próximas en este momento.</p>
          )}
          <ul className="divide-y divide-border">
            {arrivals?.map((a) => {
              const color = a.routeColor ? `#${a.routeColor}` : undefined;
              const short = a.routeShortName || a.routeName || "—";
              const min = Math.max(0, a.minutesAway);
              const time = new Date(a.estimatedArrival * 1000).toLocaleTimeString("es-ES", { hour: "2-digit", minute: "2-digit" });
              const label = `Línea ${short}, ${a.tripHeadsign || a.routeName}, ${min === 0 && !a.isScheduled ? "llegando ahora" : `en ${min} minutos`}, a las ${time}, ${a.isScheduled ? "según horario" : "en tiempo real"}`;
              return (
                <li key={`${a.tripId}-${a.vehicleId}-${a.estimatedArrival}`} aria-label={label} className="px-4 py-3.5 flex items-center gap-3 animate-fade-in">
                  <span
                    className="min-w-12 text-center px-2.5 py-1.5 rounded-xl text-xs font-bold text-white shrink-0 shadow-sm"
                    style={{ backgroundColor: color || "var(--primary)" }}
                    aria-hidden="true"
                  >
                    {short}
                  </span>
                  <div className="min-w-0 flex-1" aria-hidden="true">
                    <p className="text-[15px] font-semibold truncate">{a.tripHeadsign || a.routeName}</p>
                    <p className="text-xs text-muted-foreground flex items-center gap-1.5 mt-0.5">
                      {a.isScheduled ? (
                        <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full bg-amber-500/15 text-amber-800 dark:text-amber-300 font-medium">
                          <CalendarClock className="w-3 h-3" /> Horario
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full bg-emerald-500/15 text-emerald-800 dark:text-emerald-300 font-medium">
                          <Radio className="w-3 h-3" /> En vivo
                        </span>
                      )}
                      <span className="truncate">
                        {a.isScheduled ? "Según horario" : `Bus ${a.vehicleId}${a.isEstimated ? " · estimado" : ""}`}
                      </span>
                    </p>
                  </div>
                  <div className="text-right shrink-0" aria-hidden="true">
                    <p className={`text-2xl font-black tabular-nums leading-none ${a.isScheduled ? "text-muted-foreground" : ""}`}>
                      {min === 0 && !a.isScheduled ? "Ahora" : `${min}′`}
                    </p>
                    <p className="text-xs text-muted-foreground mt-0.5">{time}</p>
                  </div>
                </li>
              );
            })}
          </ul>
        </section>

        <div className="px-3 py-4">
          <StopScheduleViewer stopId={stop.id} />
        </div>
      </main>
    </div>
  );
}

const CARD_COLORS = ["#1d4ed8", "#0f766e", "#b45309", "#9333ea", "#dc2626", "#0891b2"];

function CardsView() {
  const [cards, setCards] = useState<BuscylCard[]>([]);
  const [editor, setEditor] = useState<{ mode: "new" } | { mode: "edit"; card: BuscylCard } | null>(null);
  const [viewing, setViewing] = useState<BuscylCard | null>(null);

  useEffect(() => {
    setCards(loadCards());
  }, []);

  const refresh = () => setCards(loadCards());

  return (
    <div className="flex-1 flex flex-col">
      {cards.length === 0 ? (
        <div className="flex-1 flex flex-col items-center justify-center text-center px-6 py-12 gap-3">
          <div className="w-16 h-16 rounded-2xl bg-primary/10 text-primary flex items-center justify-center">
            <CreditCard className="w-8 h-8" />
          </div>
              <h2 className="text-lg font-semibold">Tus tarjetas Buscyl</h2>
          <p className="text-sm text-muted-foreground max-w-xs">
            Guarda el QR de tu tarjeta Buscyl en el dispositivo para enseñarlo en el bus sin conexión.
          </p>
        </div>
      ) : (
        <ul className="flex-1 p-3 grid grid-cols-1 gap-3">
          {cards.map((c) => (
            <li key={c.id}>
              <button
                onClick={() => setViewing(c)}
                className="w-full text-left rounded-2xl p-4 flex items-center gap-3 shadow-sm active:scale-[0.99] transition-transform"
                style={{ backgroundColor: c.color || "#1d4ed8", color: "white" }}
              >
                <div className="w-12 h-12 rounded-xl bg-white/15 flex items-center justify-center shrink-0">
                  <CreditCard className="w-6 h-6" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-[10px] uppercase tracking-wider opacity-80">Buscyl</p>
                  <p className="text-sm font-semibold truncate">{c.label}</p>
                  <p className="text-[11px] opacity-80 truncate font-mono">{c.data}</p>
                </div>
              </button>
            </li>
          ))}
        </ul>
      )}

      <div className="p-4">
        <button
          onClick={() => setEditor({ mode: "new" })}
          className="w-full py-3 rounded-xl bg-primary text-primary-foreground text-sm font-semibold flex items-center justify-center gap-2 active:opacity-90"
        >
          <Plus className="w-4 h-4" /> Añadir tarjeta
        </button>
      </div>

      {editor && (
        <CardEditor
          initial={editor.mode === "edit" ? editor.card : null}
          onClose={() => setEditor(null)}
          onSaved={() => {
            setEditor(null);
            refresh();
          }}
        />
      )}

      {viewing && (
        <CardViewer
          card={viewing}
          onClose={() => setViewing(null)}
          onEdit={() => {
            setEditor({ mode: "edit", card: viewing });
            setViewing(null);
          }}
          onDelete={() => {
            removeCard(viewing.id);
            setViewing(null);
            refresh();
          }}
        />
      )}
    </div>
  );
}

function CardEditor({
  initial,
  onClose,
  onSaved,
}: {
  initial: BuscylCard | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [label, setLabel] = useState(initial?.label || "");
  const [data, setData] = useState(initial?.data || "");
  const [color, setColor] = useState(initial?.color || CARD_COLORS[0]);
  const [scanning, setScanning] = useState(false);

  const save = () => {
    const trimmedLabel = label.trim() || "Tarjeta Buscyl";
    const trimmedData = data.trim();
    if (!trimmedData) return;
    if (initial) {
      updateCard(initial.id, { label: trimmedLabel, data: trimmedData, color });
    } else {
      addCard({ label: trimmedLabel, data: trimmedData, color });
    }
    onSaved();
  };

  return (
    <div role="dialog" aria-modal="true" aria-labelledby="card-editor-title" className="fixed inset-0 z-50 bg-black/60 flex items-end sm:items-center justify-center" onClick={onClose} onKeyDown={(e) => e.key === "Escape" && onClose()}>
      <div
        className="w-full sm:max-w-md bg-background rounded-t-2xl sm:rounded-2xl p-5 space-y-4"
        onClick={(e) => e.stopPropagation()}
        style={{ paddingBottom: "calc(1.25rem + env(safe-area-inset-bottom))" }}
      >
        <div className="flex items-center gap-2">
          <h2 id="card-editor-title" className="text-base font-semibold flex-1">{initial ? "Editar tarjeta" : "Nueva tarjeta Buscyl"}</h2>
          <button onClick={onClose} className="w-10 h-10 grid place-items-center rounded-full hover:bg-accent" aria-label="Cerrar" autoFocus>
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="space-y-1.5">
          <label htmlFor="card-label" className="text-sm font-medium text-muted-foreground">Nombre</label>
          <input
            id="card-label"
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            placeholder="Mi tarjeta"
            className="w-full px-3 py-2.5 rounded-lg border border-border bg-card text-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
          />
        </div>

        <div className="space-y-1.5">
          <label htmlFor="card-data" className="text-sm font-medium text-muted-foreground">Contenido del QR (número o texto)</label>
          <textarea
            id="card-data"
            value={data}
            onChange={(e) => setData(e.target.value)}
            placeholder="Pega aquí el código de tu tarjeta Buscyl"
            rows={3}
            className="w-full px-3 py-2.5 rounded-lg border border-border bg-card text-sm font-mono focus:outline-none focus:ring-2 focus:ring-primary/40"
          />
          <button
            onClick={() => setScanning(true)}
            type="button"
            className="w-full mt-1 py-2.5 rounded-lg border border-border bg-card text-sm font-medium flex items-center justify-center gap-2 active:bg-accent"
          >
            <Camera className="w-4 h-4" /> Escanear QR con la cámara
          </button>
          <p className="text-[11px] text-muted-foreground">
            Se guarda solo en este dispositivo (almacenamiento local). Nada se envía a ningún servidor.
          </p>
        </div>

        <div className="space-y-1.5">
          <p className="text-sm font-medium text-muted-foreground">Color</p>
          <div className="flex gap-2 flex-wrap">
            {CARD_COLORS.map((c) => (
              <button
                key={c}
                onClick={() => setColor(c)}
                aria-pressed={color === c}
                className={`w-10 h-10 rounded-full border-2 ${color === c ? "border-foreground" : "border-transparent"}`}
                style={{ backgroundColor: c }}
                aria-label={`Color ${CARD_COLORS.indexOf(c) + 1}`}
              />
            ))}
          </div>
        </div>

        <button
          onClick={save}
          disabled={!data.trim()}
          className="w-full py-3 rounded-xl bg-primary text-primary-foreground text-sm font-semibold disabled:opacity-50"
        >
          {initial ? "Guardar cambios" : "Guardar tarjeta"}
        </button>
        {scanning && (
          <QrScanner
            onClose={() => setScanning(false)}
            onResult={(text) => {
              setData(text);
              setScanning(false);
            }}
          />
        )}
      </div>
    </div>
  );
}

function QrScanner({ onClose, onResult }: { onClose: () => void; onResult: (text: string) => void }) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [starting, setStarting] = useState(true);

  useEffect(() => {
    let stopped = false;
    let controls: { stop: () => void } | null = null;
    let reader: { reset?: () => void } | null = null;

    (async () => {
      try {
        const { BrowserQRCodeReader } = await import("@zxing/browser");
        if (stopped) return;
        const codeReader = new BrowserQRCodeReader();
        reader = codeReader as unknown as { reset?: () => void };
        const devices = await BrowserQRCodeReader.listVideoInputDevices();
        const back = devices.find((d) => /back|rear|environment|trasera/i.test(d.label));
        const deviceId = back?.deviceId || devices[0]?.deviceId;
        if (!videoRef.current) return;
        const ctrl = await codeReader.decodeFromVideoDevice(
          deviceId,
          videoRef.current,
          (result, err) => {
            if (stopped) return;
            if (result) {
              const text = result.getText();
              if (text) {
                stopped = true;
                ctrl.stop();
                onResult(text);
              }
            }
            // ignore "not found" errors — they fire continuously while scanning
          }
        );
        controls = ctrl;
        setStarting(false);
      } catch (e: any) {
        setError(
          e?.name === "NotAllowedError"
            ? "Permiso de cámara denegado. Habilítalo en los ajustes del navegador."
            : e?.name === "NotFoundError"
            ? "No se ha detectado ninguna cámara."
            : "No se pudo iniciar la cámara."
        );
        setStarting(false);
      }
    })();

    return () => {
      stopped = true;
      try { controls?.stop(); } catch {}
      try { reader?.reset?.(); } catch {}
    };
  }, [onResult]);

  const onPickFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const { BrowserQRCodeReader } = await import("@zxing/browser");
      const codeReader = new BrowserQRCodeReader();
      const url = URL.createObjectURL(file);
      try {
        const result = await codeReader.decodeFromImageUrl(url);
        const text = result.getText();
        if (text) onResult(text);
        else setError("No se ha encontrado ningún QR en la imagen.");
      } finally {
        URL.revokeObjectURL(url);
      }
    } catch {
      setError("No se ha podido leer el QR de la imagen.");
    }
  };

  return (
    <div role="dialog" aria-modal="true" aria-label="Escanear QR" className="fixed inset-0 z-[60] bg-black flex flex-col" style={{ paddingTop: "env(safe-area-inset-top)", paddingBottom: "env(safe-area-inset-bottom)" }}>
      <header className="flex items-center gap-2 px-3 py-3 text-white">
        <button onClick={onClose} className="w-11 h-11 grid place-items-center rounded-full hover:bg-white/10 active:bg-white/10" aria-label="Cerrar">
          <X className="w-5 h-5" />
        </button>
        <h2 className="text-sm font-semibold flex-1">Escanear QR Buscyl</h2>
      </header>

      <div className="relative flex-1 overflow-hidden">
        <video
          ref={videoRef}
          className="absolute inset-0 w-full h-full object-cover"
          playsInline
          muted
        />
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <div className="w-64 h-64 border-2 border-white/80 rounded-2xl shadow-[0_0_0_9999px_rgba(0,0,0,0.45)] relative">
            <ScanLine className="absolute inset-0 m-auto w-10 h-10 text-white/70 animate-pulse" />
          </div>
        </div>
        {starting && !error && (
          <div className="absolute inset-0 flex items-center justify-center text-white text-sm">
            Iniciando cámara…
          </div>
        )}
        {error && (
          <div className="absolute inset-x-0 bottom-0 p-4 bg-black/70 text-white text-sm text-center">
            {error}
          </div>
        )}
      </div>

      <div className="p-4 space-y-2">
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={onPickFile}
        />
        <button
          onClick={() => fileInputRef.current?.click()}
          className="w-full py-3 rounded-xl bg-white/10 text-white text-sm font-medium flex items-center justify-center gap-2 active:bg-white/20"
        >
          <Camera className="w-4 h-4" /> Subir imagen del QR
        </button>
        <p className="text-[11px] text-white/60 text-center">
          Apunta la cámara al QR de tu tarjeta Buscyl. Se detectará automáticamente.
        </p>
      </div>
    </div>
  );
}

function CardViewer({
  card,
  onClose,
  onEdit,
  onDelete,
}: {
  card: BuscylCard;
  onClose: () => void;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const [qr, setQr] = useState<string>("");
  const [confirmDelete, setConfirmDelete] = useState(false);

  useEffect(() => {
    QRCode.toDataURL(card.data, { width: 600, margin: 2, errorCorrectionLevel: "M" })
      .then(setQr)
      .catch(() => setQr(""));
  }, [card.data]);

  return (
    <div role="dialog" aria-modal="true" aria-label={`Tarjeta ${card.label}`} className="fixed inset-0 z-50 bg-black/80 flex flex-col" onClick={onClose} onKeyDown={(e) => e.key === "Escape" && onClose()}>
      <div
        className="flex-1 flex flex-col"
        onClick={(e) => e.stopPropagation()}
        style={{ paddingTop: "env(safe-area-inset-top)", paddingBottom: "env(safe-area-inset-bottom)" }}
      >
        <header className="flex items-center gap-2 px-3 py-3 text-white">
          <button onClick={onClose} className="w-11 h-11 grid place-items-center rounded-full hover:bg-white/10 active:bg-white/10" aria-label="Volver">
            <ArrowLeft className="w-5 h-5" />
          </button>
          <h2 className="text-sm font-semibold flex-1 truncate">{card.label}</h2>
          <button onClick={onEdit} className="w-11 h-11 grid place-items-center rounded-full hover:bg-white/10 active:bg-white/10" aria-label="Editar">
            <Pencil className="w-4 h-4" />
          </button>
          <button onClick={() => setConfirmDelete(true)} className="w-11 h-11 grid place-items-center rounded-full hover:bg-white/10 active:bg-white/10" aria-label="Eliminar">
            <Trash2 className="w-4 h-4" />
          </button>
        </header>

        <div className="flex-1 flex flex-col items-center justify-center px-6 gap-6">
          <div className="bg-white p-5 rounded-2xl shadow-2xl">
            {qr ? (
              <img src={qr} alt={`QR de ${card.label}`} className="w-64 h-64 sm:w-72 sm:h-72" />
            ) : (
              <div className="w-64 h-64 sm:w-72 sm:h-72 flex items-center justify-center text-xs text-muted-foreground">
                Generando…
              </div>
            )}
          </div>
          <div className="text-center text-white/90">
            <p className="text-xs uppercase tracking-wider opacity-70">Tarjeta Buscyl</p>
            <p className="text-base font-semibold">{card.label}</p>
            <p className="text-[11px] font-mono opacity-70 mt-1 break-all max-w-xs">{card.data}</p>
          </div>
        </div>

        {confirmDelete && (
          <div role="alertdialog" aria-modal="true" aria-labelledby="confirm-del" className="absolute inset-0 bg-black/70 flex items-center justify-center p-6" onClick={() => setConfirmDelete(false)}>
            <div className="bg-background rounded-2xl p-5 max-w-sm w-full space-y-4" onClick={(e) => e.stopPropagation()}>
              <h3 id="confirm-del" className="text-base font-semibold">Eliminar tarjeta</h3>
              <p className="text-sm text-muted-foreground">¿Seguro que quieres eliminar “{card.label}”? Esta acción no se puede deshacer.</p>
              <div className="flex gap-2">
                <button onClick={() => setConfirmDelete(false)} className="flex-1 py-2.5 rounded-lg border border-border text-sm font-medium">
                  Cancelar
                </button>
                <button onClick={onDelete} className="flex-1 py-2.5 rounded-lg bg-destructive text-destructive-foreground text-sm font-semibold">
                  Eliminar
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
