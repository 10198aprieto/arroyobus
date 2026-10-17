import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { ArrowLeft, Bus, Copy, RefreshCw, ExternalLink, Check } from "lucide-react";

export const Route = createFileRoute("/buses")({
  head: () => ({
    meta: [
      { title: "Buses en servicio — URLs por vehículo · ArroyoBus" },
      { name: "description", content: "Directorio en tiempo real de los autobuses ArroyoBus en servicio, con URL individual (JSON y panel a bordo) para cada bus." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: BusesPage,
});

interface BusItem {
  vehicleId: string;
  label: string;
  routeId: string | null;
  lat: number;
  lon: number;
  speed: number | null;
  bearing: number | null;
  timestamp: number | null;
  url: string;
}

const PANEL_BASE_KEY = "arroyobus_panel_base";

function routeColor(routeId: string | null): string {
  switch (routeId) {
    case "Roja": return "#ca0d32";
    case "Azul": return "#3b4cd1";
    case "Verde": return "#2ea846";
    default: return "#64748b";
  }
}

function BusesPage() {
  const [buses, setBuses] = useState<BusItem[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [updated, setUpdated] = useState("");
  const [panelBase, setPanelBase] = useState<string>("");
  const [copied, setCopied] = useState<string | null>(null);

  useEffect(() => {
    const saved = typeof window !== "undefined" ? localStorage.getItem(PANEL_BASE_KEY) : "";
    setPanelBase(saved || "");
  }, []);

  const load = async () => {
    try {
      const res = await fetch("/api/buses");
      if (!res.ok) return;
      const json = await res.json();
      setBuses(json.buses || []);
      setUpdated(new Date().toLocaleTimeString("es-ES"));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    const i = setInterval(load, 10_000);
    return () => clearInterval(i);
  }, []);

  const savePanelBase = (v: string) => {
    setPanelBase(v);
    if (typeof window !== "undefined") {
      if (v) localStorage.setItem(PANEL_BASE_KEY, v);
      else localStorage.removeItem(PANEL_BASE_KEY);
    }
  };

  const panelUrlFor = (id: string) => {
    if (!panelBase) return "";
    const sep = panelBase.includes("?") ? "&" : "?";
    return `${panelBase}${sep}bus=${encodeURIComponent(id)}`;
  };

  const copy = async (text: string, key: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(key);
      setTimeout(() => setCopied((c) => (c === key ? null : c)), 1500);
    } catch { /* noop */ }
  };

  const sorted = useMemo(() => buses ?? [], [buses]);

  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="sticky top-0 z-10 bg-background/95 backdrop-blur border-b border-border">
        <div className="max-w-4xl mx-auto px-4 py-3 flex items-center gap-3">
          <Link to="/" className="p-2 -ml-2 rounded-lg hover:bg-accent" aria-label="Volver">
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <div className="min-w-0 flex-1">
            <p className="text-[11px] text-muted-foreground">Directorio en tiempo real</p>
            <h1 className="text-base font-semibold truncate">Buses en servicio</h1>
          </div>
          <button onClick={load} className="p-2 rounded-md hover:bg-accent" aria-label="Refrescar">
            <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
          </button>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 py-4 space-y-4">
        <section className="rounded-xl border border-border bg-card p-4 space-y-2">
          <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
            Base URL del panel a bordo (opcional)
          </label>
          <input
            type="url"
            value={panelBase}
            onChange={(e) => savePanelBase(e.target.value)}
            placeholder="https://mi-panel.ejemplo.com/"
            className="w-full px-3 py-2 rounded-lg border border-border bg-background text-sm"
          />
          <p className="text-[11px] text-muted-foreground">
            Se añadirá <code>?bus=&lt;id&gt;</code> automáticamente. Se guarda en tu navegador. Déjalo vacío si sólo quieres las URLs JSON.
          </p>
        </section>

        <section className="rounded-xl border border-border bg-card">
          <div className="px-4 py-3 border-b border-border flex items-center justify-between">
            <h2 className="text-sm font-semibold flex items-center gap-2">
              <Bus className="w-4 h-4 text-primary" />
              {sorted.length} bus{sorted.length === 1 ? "" : "es"} en servicio
            </h2>
            {updated && <span className="text-[11px] text-muted-foreground">Actualizado {updated}</span>}
          </div>
          <ul className="divide-y divide-border">
            {loading && !buses && (
              <li className="px-4 py-6 text-center text-sm text-muted-foreground">Cargando…</li>
            )}
            {buses && buses.length === 0 && (
              <li className="px-4 py-6 text-center text-sm text-muted-foreground">No hay buses en servicio ahora mismo.</li>
            )}
            {sorted.map((b) => {
              const panelUrl = panelUrlFor(b.vehicleId);
              const jsonUrl = b.url;
              return (
                <li key={b.vehicleId} className="px-4 py-3 space-y-2">
                  <div className="flex items-center gap-3">
                    <span className="px-2.5 py-1 rounded-full text-[11px] font-semibold text-white shrink-0"
                      style={{ backgroundColor: routeColor(b.routeId) }}>
                      {b.routeId || "—"}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-semibold">Bus {b.label}</p>
                      <p className="text-[11px] text-muted-foreground tabular-nums">
                        {b.lat.toFixed(5)}, {b.lon.toFixed(5)}
                        {typeof b.speed === "number" && ` · ${Math.round(b.speed * 3.6)} km/h`}
                      </p>
                    </div>
                  </div>

                  <div className="grid gap-1.5">
                    <UrlRow
                      label="JSON"
                      url={jsonUrl}
                      copiedKey={copied}
                      onCopy={() => copy(jsonUrl, `json-${b.vehicleId}`)}
                      keyId={`json-${b.vehicleId}`}
                    />
                    {panelUrl && (
                      <UrlRow
                        label="Panel"
                        url={panelUrl}
                        copiedKey={copied}
                        onCopy={() => copy(panelUrl, `panel-${b.vehicleId}`)}
                        keyId={`panel-${b.vehicleId}`}
                      />
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        </section>

        <section className="rounded-xl border border-border bg-card p-4 text-xs text-muted-foreground space-y-1">
          <p><strong className="text-foreground">Endpoints:</strong></p>
          <p><code>GET /api/buses</code> — lista de todos los vehículos activos.</p>
          <p><code>GET /api/buses/&lt;vehicleId&gt;</code> — posición y próximas paradas de un bus.</p>
        </section>
      </main>
    </div>
  );
}

function UrlRow({ label, url, keyId, copiedKey, onCopy }: {
  label: string; url: string; keyId: string; copiedKey: string | null; onCopy: () => void;
}) {
  const isCopied = copiedKey === keyId;
  return (
    <div className="flex items-center gap-2 rounded-md border border-border bg-background px-2 py-1.5">
      <span className="text-[10px] font-bold uppercase text-muted-foreground w-12 shrink-0">{label}</span>
      <code className="text-[11px] flex-1 truncate">{url}</code>
      <a href={url} target="_blank" rel="noopener noreferrer"
         className="p-1 rounded hover:bg-accent" aria-label="Abrir">
        <ExternalLink className="w-3.5 h-3.5" />
      </a>
      <button onClick={onCopy} className="p-1 rounded hover:bg-accent" aria-label="Copiar">
        {isCopied ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
      </button>
    </div>
  );
}