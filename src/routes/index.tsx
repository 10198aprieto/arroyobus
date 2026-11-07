import { createFileRoute, Link } from "@tanstack/react-router";
import { Bus, MapPin, Clock, ExternalLink, Download, Smartphone, Send, Copy, Check, Activity, Radio, HelpCircle, AlertTriangle, } from "lucide-react";
import { lazy, Suspense, useEffect, useState } from "react";

const BusMap = lazy(() => import("@/components/BusMap"));
import SanAntonioBanner from "@/components/SanAntonioBanner";
import PresenceBadge from "@/components/PresenceBadge";
import AirQualityBadge from "@/components/AirQualityBadge";
import { Typewriter } from "@/components/ui/typewriter";
import VaporizeTextCycle, { Tag as VaporTag } from "@/components/ui/vapour-text-effect";
import { useIsIOS } from "@/hooks/use-platform";
import Dashboard from "@/components/Dashboard";
import AutoNightMode from "@/components/AutoNightMode";

export const Route = createFileRoute("/")({
  component: Index,
  head: () => ({
    meta: [
      { title: "ArroyoBus — Autobuses en tiempo real" },
      { name: "description", content: "Sigue en tiempo real los autobuses de Arroyo de la Encomienda. Llegadas, posiciones GPS, feed GTFS-RT y bot de Telegram." },
      { property: "og:title", content: "ArroyoBus — Autobuses de Arroyo en tiempo real" },
      { property: "og:description", content: "Mapa en vivo, próximas llegadas por parada, avisos del servicio y feed GTFS-RT abierto de Arroyo de la Encomienda." },
      { property: "og:url", content: "https://arroyobus.lovable.app/" },
      { property: "og:type", content: "website" },
      { name: "twitter:title", content: "ArroyoBus — Autobuses de Arroyo en tiempo real" },
      { name: "twitter:description", content: "Mapa en vivo, próximas llegadas por parada, avisos del servicio y feed GTFS-RT abierto." },
    ],
    links: [{ rel: "canonical", href: "https://arroyobus.lovable.app/" }],
    scripts: [
      {
        type: "application/ld+json",
        children: JSON.stringify({
          "@context": "https://schema.org",
          "@type": "Service",
          name: "ArroyoBus — seguimiento de autobuses en tiempo real",
          serviceType: "Información de transporte público en tiempo real",
          url: "https://arroyobus.lovable.app/",
          areaServed: {
            "@type": "City",
            name: "Arroyo de la Encomienda",
            address: {
              "@type": "PostalAddress",
              addressLocality: "Arroyo de la Encomienda",
              addressRegion: "Valladolid",
              addressCountry: "ES",
            },
          },
          provider: { "@type": "Organization", name: "ArroyoBus", url: "https://arroyobus.lovable.app" },
          description:
            "Llegadas al minuto, posiciones GPS de las líneas Roja, Azul, Verde y Búho, avisos del servicio y feed GTFS-RT abierto.",
        }),
      },
    ],
  }),
});

function CopyButton({ value }: { value: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      onClick={() => {
        navigator.clipboard.writeText(window.location.origin + value);
        setCopied(true);
        setTimeout(() => setCopied(false), 1500);
      }}
      className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs font-medium border border-border hover:bg-accent transition-all"
      aria-label="Copiar URL"
    >
      {copied ? <><Check className="w-3 h-3" /> Copiado</> : <><Copy className="w-3 h-3" /> Copiar</>}
    </button>
  );
}

function LiveStats() {
  const [vehicles, setVehicles] = useState<number | null>(null);
  const [pulse, setPulse] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const fetchCount = async () => {
      try {
        const res = await fetch("/api/gtfs-rt/vehicle-positions?format=json");
        if (!res.ok) return;
        const data = await res.json();
        if (!cancelled) {
          setVehicles((data.entity ?? []).length);
          setPulse(true);
          setTimeout(() => setPulse(false), 600);
        }
      } catch {}
    };
    fetchCount();
    const id = setInterval(fetchCount, 15_000);
    return () => { cancelled = true; clearInterval(id); };
  }, []);

  const stats = [
    { label: "Buses en circulación", value: vehicles == null ? "—" : vehicles, icon: Bus, live: true },
    { label: "Paradas", value: "73", icon: MapPin, live: false },
    { label: "Líneas", value: "4", icon: Activity, live: false },
  ];

  return (
    <div className="grid grid-cols-3 gap-3 sm:gap-4">
      {stats.map((s) => (
        <div key={s.label} className="ios-press glass relative p-4 rounded-2xl overflow-hidden group hover:border-primary/40 transition-all">
          <div className="flex items-center justify-between mb-2">
            <s.icon className="w-4 h-4 text-primary" />
            {s.live && (
              <span className="flex items-center gap-1 text-[10px] font-semibold text-primary uppercase tracking-wider">
                <span className={`w-1.5 h-1.5 rounded-full bg-primary ${pulse ? "animate-ping" : ""}`} />
                Live
              </span>
            )}
          </div>
          <div className="text-2xl sm:text-3xl font-bold text-foreground tabular-nums">{s.value}</div>
          <div className="text-[11px] sm:text-xs text-muted-foreground mt-0.5 leading-tight">{s.label}</div>
        </div>
      ))}
    </div>
  );
}

function Index() {
  const isIOS = useIsIOS();
  const endpoints = [
    {
      title: "Trip Updates",
      description: "Estimaciones de llegada en tiempo real para cada parada y viaje activo.",
      pb: "/api/gtfs-rt/trip-updates",
      json: "/api/gtfs-rt/trip-updates?format=json",
      icon: Clock,
    },
    {
      title: "Vehicle Positions",
      description: "Posiciones GPS en tiempo real de los autobuses activos.",
      pb: "/api/gtfs-rt/vehicle-positions",
      json: "/api/gtfs-rt/vehicle-positions?format=json",
      icon: MapPin,
    },
  ];

  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* HERO con gradient */}
      <header className="relative overflow-hidden border-b border-border">
        <div
          className="absolute inset-0 opacity-90"
          style={{ background: "var(--gradient-hero)" }}
          aria-hidden
        />
        <div
          className="absolute inset-0 opacity-30"
          style={{
            backgroundImage:
              "radial-gradient(circle at 20% 20%, rgba(255,255,255,0.25), transparent 40%), radial-gradient(circle at 80% 60%, rgba(255,255,255,0.15), transparent 50%)",
          }}
          aria-hidden
        />

        <div className="relative max-w-5xl mx-auto px-6 pt-12 pb-16 sm:pt-20 sm:pb-24">
          <div className="flex items-center gap-2 mb-6">
            <div className="flex items-center gap-2 px-3 py-1 rounded-full bg-white/15 backdrop-blur-sm text-white text-xs font-medium">
              <Radio className="w-3 h-3 animate-pulse" />
              Datos en tiempo real
            </div>
          </div>

          <h1 className="text-5xl sm:text-7xl font-black tracking-tight text-white mb-4 leading-[0.95]">
            Arroyo<span className="text-amber-300">Bus</span>
            <span className="block mt-2 text-xl sm:text-3xl font-bold text-white/90">
              Autobuses de Arroyo de la Encomienda en tiempo real
            </span>
          </h1>
          <p className="text-lg sm:text-xl text-white/90 max-w-2xl mb-8 leading-relaxed">
            Sigue los autobuses de <strong>Arroyo de la Encomienda</strong> en tiempo real.{" "}
            <Typewriter
              text={[
                "Llegadas al minuto.",
                "Posiciones GPS en vivo.",
                "Feed GTFS-RT abierto.",
                "Bot de Telegram incluido.",
              ]}
              speed={45}
              deleteSpeed={25}
              waitTime={1800}
              className="text-amber-200 font-semibold"
              cursorClassName="ml-0.5 text-amber-200"
            />
          </p>

          <div className="flex flex-wrap gap-3">
            <Link
              to="/app"
              className="ios-press inline-flex items-center gap-2 px-5 py-3 rounded-2xl bg-white text-primary font-semibold text-sm hover:scale-[1.02] active:scale-[0.98] transition-transform shadow-lg"
            >
              <Smartphone className="w-4 h-4" />
              Abrir app
            </Link>
            <a
              href="https://t.me/arroyobus_bot"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 px-5 py-3 rounded-xl bg-white/15 text-white font-semibold text-sm backdrop-blur-sm border border-white/20 hover:bg-white/25 transition-colors"
            >
              <Send className="w-4 h-4" />
              Bot Telegram
            </a>
            <a
              href="#mapa"
              className="inline-flex items-center gap-2 px-5 py-3 rounded-xl text-white font-semibold text-sm hover:bg-white/10 transition-colors"
            >
              Ver mapa en vivo →
            </a>
          </div>

          {isIOS && (
            <p className="mt-5 inline-flex items-center gap-2 px-3 py-2 rounded-full bg-white/15 backdrop-blur-md border border-white/25 text-white/90 text-xs">
              <Smartphone className="w-3.5 h-3.5" />
              Consejo iPhone: pulsa <span className="font-semibold">Compartir</span> → <span className="font-semibold">Añadir a pantalla de inicio</span>
            </p>
          )}
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-6 py-10 sm:py-14 space-y-12">
        <AutoNightMode />

        {/* Stats */}
        <section aria-label="Estadísticas en tiempo real" className="-mt-20 sm:-mt-24 relative z-10">
          <LiveStats />
        </section>

        {/* Panel personal */}
        <Dashboard />

        <div className="flex flex-wrap items-center gap-3">
          <PresenceBadge />
          <AirQualityBadge />
          <Link
            to="/avisos"
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-amber-500/15 text-amber-700 dark:text-amber-300 text-xs font-semibold hover:bg-amber-500/25 transition-colors"
          >
            <AlertTriangle className="w-3.5 h-3.5" />
            Avisos y alertas
          </Link>
        </div>

        <SanAntonioBanner />

        {/* Mapa */}
        <section id="mapa" aria-labelledby="mapa-title" className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 id="mapa-title" className="text-2xl font-bold tracking-tight">Mapa en vivo</h2>
            <span className="text-xs text-muted-foreground">Actualización cada 15 s</span>
          </div>
          <Suspense fallback={<div className="border border-border rounded-2xl h-[440px] bg-card animate-pulse" />}>
            <BusMap />
          </Suspense>
        </section>

        {/* Vapour text hero band */}
        <section
          aria-label="Marca"
          className="relative overflow-hidden rounded-2xl border border-border h-56 sm:h-64 flex items-center justify-center"
          style={{ background: "var(--gradient-hero)" }}
        >
          <div
            className="absolute inset-0 opacity-30"
            style={{
              backgroundImage:
                "radial-gradient(circle at 20% 30%, rgba(255,255,255,0.35), transparent 45%), radial-gradient(circle at 80% 70%, rgba(255,255,255,0.2), transparent 50%)",
            }}
            aria-hidden
          />
          <div className="relative w-full h-full">
            <VaporizeTextCycle
              texts={["ArroyoBus", "Tiempo real", "Línea Roja", "Línea Azul", "Línea Verde", "Búho", "GTFS-RT"]}
              font={{ fontFamily: "Inter, system-ui, sans-serif", fontSize: "72px", fontWeight: 800 }}
              color="rgb(255, 220, 120)"
              spread={4}
              density={6}
              animation={{ vaporizeDuration: 1.8, fadeInDuration: 0.8, waitDuration: 1.2 }}
              direction="left-to-right"
              alignment="center"
              tag={VaporTag.H2}
            />
          </div>
        </section>

        {/* Canales y bot */}
        <section aria-labelledby="canales-title" className="space-y-4">
          <h2 id="canales-title" className="text-2xl font-bold tracking-tight">Canales y bot</h2>
          <div className="grid gap-4 md:grid-cols-3">
            {/* Canal de Telegram */}
            <a
              href="https://t.me/arroyobus"
              target="_blank"
              rel="noopener noreferrer"
              className="group ios-press glass rounded-2xl border-sky-200/70 dark:border-sky-900/70 bg-sky-50/60 dark:bg-sky-950/30 p-6 hover:shadow-lg hover:-translate-y-0.5 transition-all"
            >
              <div className="flex items-start gap-4">
                <div className="flex-shrink-0 w-12 h-12 rounded-2xl flex items-center justify-center text-white bg-gradient-to-br from-sky-400 to-blue-600 shadow-md">
                  <Send className="w-5 h-5" />
                </div>
                <div className="min-w-0">
                  <h3 className="text-lg font-bold text-foreground mb-1">Canal de Telegram</h3>
                  <p className="text-sm text-muted-foreground mb-3">
                    Suscríbete para recibir avisos, incidencias y novedades del servicio.
                  </p>
                  <span className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-sky-600 text-white text-xs font-semibold">
                    <Send className="w-3.5 h-3.5" /> Unirse al canal
                  </span>
                </div>
              </div>
            </a>

            {/* Canal de WhatsApp */}
            <a
              href="https://whatsapp.com/channel/0029Vb8UC0KCBtx7VxjSsq2m"
              target="_blank"
              rel="noopener noreferrer"
              className="group ios-press glass rounded-2xl border-emerald-200/70 dark:border-emerald-900/70 bg-emerald-50/60 dark:bg-emerald-950/30 p-6 hover:shadow-lg hover:-translate-y-0.5 transition-all"
            >
              <div className="flex items-start gap-4">
                <div className="flex-shrink-0 w-12 h-12 rounded-2xl flex items-center justify-center text-white bg-gradient-to-br from-emerald-400 to-green-600 shadow-md">
                  <svg viewBox="0 0 24 24" fill="currentColor" className="w-6 h-6"><path d="M17.5 14.4c-.3-.1-1.7-.8-2-.9-.3-.1-.5-.1-.7.1-.2.3-.7.9-.9 1.1-.2.2-.3.2-.6.1-1.7-.8-2.8-1.5-3.9-3.4-.3-.5.3-.5.8-1.5.1-.2 0-.4 0-.5 0-.1-.7-1.6-.9-2.2-.2-.6-.5-.5-.7-.5h-.6c-.2 0-.5.1-.8.4-.3.3-1 1-1 2.4s1.1 2.8 1.2 3c.2.2 2.1 3.2 5 4.5 1.8.7 2.5.8 3.4.7.6-.1 1.7-.7 2-1.4.2-.7.2-1.3.2-1.4-.1-.1-.3-.2-.5-.3zM12 2C6.5 2 2 6.5 2 12c0 1.9.5 3.7 1.5 5.3L2 22l4.9-1.5c1.6.9 3.3 1.3 5.1 1.3 5.5 0 10-4.5 10-10S17.5 2 12 2zm0 18.3c-1.6 0-3.1-.4-4.4-1.2l-.3-.2-3.3 1 .9-3.2-.2-.3C4 15 3.5 13.5 3.5 12 3.5 7.3 7.3 3.5 12 3.5S20.5 7.3 20.5 12 16.7 20.3 12 20.3z"/></svg>
                </div>
                <div className="min-w-0">
                  <h3 className="text-lg font-bold text-foreground mb-1">Canal de WhatsApp</h3>
                  <p className="text-sm text-muted-foreground mb-3">
                    Recibe los mismos avisos directamente en WhatsApp, sin instalar nada.
                  </p>
                  <span className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-emerald-600 text-white text-xs font-semibold">
                    Seguir canal
                  </span>
                </div>
              </div>
            </a>

            {/* Bot de Telegram */}
            <a
              href="https://t.me/arroyobus_bot"
              target="_blank"
              rel="noopener noreferrer"
              className="group ios-press glass rounded-2xl border-indigo-200/70 dark:border-indigo-900/70 bg-indigo-50/60 dark:bg-indigo-950/30 p-6 hover:shadow-lg hover:-translate-y-0.5 transition-all"
            >
              <div className="flex items-start gap-4">
                <div className="flex-shrink-0 w-12 h-12 rounded-2xl flex items-center justify-center text-white bg-gradient-to-br from-indigo-400 via-blue-500 to-cyan-400 shadow-md">
                  <Send className="w-5 h-5" />
                </div>
                <div className="min-w-0">
                  <h3 className="text-lg font-bold text-foreground mb-1">Bot de Telegram</h3>
                  <p className="text-sm text-muted-foreground mb-3">
                    Consulta paradas, configura alertas y recibe avisos cuando un bus esté a punto de llegar.
                  </p>
                  <span className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-indigo-600 text-white text-xs font-semibold">
                    <Send className="w-3.5 h-3.5" /> Abrir @arroyobus_bot
                  </span>
                </div>
              </div>
            </a>
          </div>
          <div className="flex flex-wrap gap-2 text-xs">
            <code className="px-2 py-1 rounded-md bg-background border border-border">/parada 100</code>
            <code className="px-2 py-1 rounded-md bg-background border border-border">/buscar Camino</code>
            <code className="px-2 py-1 rounded-md bg-background border border-border">/alertar 100 5</code>
            <code className="px-2 py-1 rounded-md bg-background border border-border">/recordar 100 08:30</code>
          </div>
        </section>

        {/* Ayuda */}
        <section
          aria-labelledby="ayuda-title"
          className="glass rounded-2xl p-6 flex flex-col sm:flex-row items-start sm:items-center gap-4"
        >
          <div className="w-12 h-12 rounded-xl bg-primary/10 text-primary flex items-center justify-center flex-shrink-0">
            <HelpCircle className="w-5 h-5" />
          </div>
          <div className="flex-1">
            <h2 id="ayuda-title" className="text-lg font-semibold">Centro de ayuda</h2>
            <p className="text-sm text-muted-foreground">
              Guías de uso, preguntas frecuentes y cómo aprovechar todas las funciones de ArroyoBus.
            </p>
          </div>
          <a
            href="https://arroyobus.gitbook.io/ayuda/"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-semibold hover:opacity-90 transition-opacity"
          >
            Abrir ayuda <ExternalLink className="w-3.5 h-3.5" />
          </a>
        </section>

        {/* Endpoints GTFS-RT */}
        <section aria-labelledby="api-title" className="space-y-4">
          <div>
            <h2 id="api-title" className="text-2xl font-bold tracking-tight">API GTFS-Realtime</h2>
            <p className="text-sm text-muted-foreground mt-1">
              Feed abierto compatible con Google Maps, Transit App, OpenTripPlanner y cualquier cliente GTFS-RT.
            </p>
          </div>
          <div className="grid sm:grid-cols-2 gap-4">
            {endpoints.map((ep) => (
              <article
                key={ep.title}
                className="group ios-press glass relative rounded-2xl p-6 hover:border-primary/40 hover:shadow-lg transition-all"
              >
                <div className="flex items-center gap-2 mb-2">
                  <div className="w-9 h-9 rounded-lg bg-primary/10 text-primary flex items-center justify-center">
                    <ep.icon className="w-4 h-4" />
                  </div>
                  <h3 className="text-lg font-semibold">{ep.title}</h3>
                </div>
                <p className="text-muted-foreground text-sm mb-4">{ep.description}</p>
                <div className="flex flex-wrap gap-2 mb-3">
                  <a
                    href={ep.pb}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-primary text-primary-foreground rounded-md text-xs font-semibold hover:opacity-90 transition-opacity"
                  >
                    Protobuf <ExternalLink className="w-3 h-3" />
                  </a>
                  <a
                    href={ep.json}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 border border-border rounded-md text-xs font-semibold hover:bg-accent transition-colors"
                  >
                    JSON <ExternalLink className="w-3 h-3" />
                  </a>
                  <CopyButton value={ep.pb} />
                </div>
                <code className="block text-[11px] text-muted-foreground bg-background border border-border rounded-md px-2 py-1.5 truncate font-mono">
                  {ep.pb}
                </code>
              </article>
            ))}
          </div>
        </section>

        {/* GTFS Static */}
        <section
          aria-labelledby="static-title"
          className="glass rounded-2xl p-6 flex flex-col sm:flex-row items-start sm:items-center gap-4"
        >
          <div className="w-12 h-12 rounded-xl bg-primary/10 text-primary flex items-center justify-center flex-shrink-0">
            <Download className="w-5 h-5" />
          </div>
          <div className="flex-1">
            <h2 id="static-title" className="text-lg font-semibold">GTFS Static</h2>
            <p className="text-sm text-muted-foreground">
              Paradas, rutas, horarios y calendario en formato GTFS.
            </p>
          </div>
          <a
            href="/GTFS_Static.zip"
            download
            className="inline-flex items-center gap-1.5 px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-semibold hover:opacity-90 transition-opacity"
          >
            <Download className="w-3.5 h-3.5" /> Descargar .zip
          </a>
        </section>

        <footer className="pt-8 pb-12 text-center text-xs text-muted-foreground space-y-1 border-t border-border">
          <p>Datos obtenidos de la API pública de ActioSAE · ArroyoBus · Arroyo de la Encomienda</p>
          <p>
            Datos de AUVASA obtenidos del repositorio{" "}
            <a
              href="https://github.com/VallaBus/api-auvasa"
              target="_blank"
              rel="noopener noreferrer"
              className="underline hover:text-foreground transition-colors"
            >
              api-auvasa de VallaBus
            </a>
          </p>

          <p>
            © {new Date().getFullYear()} Mateo Fernández Prieto · Todos los derechos reservados ·{" "}
            <Link to="/aviso-legal" className="underline hover:text-foreground transition-colors">
              Aviso legal
            </Link>
            {" · "}
            <Link to="/politica-privacidad" className="underline hover:text-foreground transition-colors">
              Privacidad
            </Link>
            {" · "}
            <Link to="/politica-cookies" className="underline hover:text-foreground transition-colors">
              Cookies
            </Link>
            {" · "}
            <a href="https://arroyobus.gitbook.io/ayuda/" target="_blank" rel="noopener noreferrer" className="underline hover:text-foreground transition-colors">
              Ayuda
            </a>
            {" · "}
            <Link to="/contacto" className="underline hover:text-foreground transition-colors">
              Contacto
            </Link>
            {" · "}
            <Link to="/avisos" className="underline hover:text-foreground transition-colors text-amber-600 dark:text-amber-400">
              ⚠ Avisos
            </Link>
          </p>
        </footer>
      </main>
    </div>
  );
}
