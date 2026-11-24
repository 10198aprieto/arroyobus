import { useEffect, useState } from "react";
import { SatelliteDish } from "lucide-react";

/** Aviso cuando el feed GTFS-RT no devuelve ningún vehículo con posición. */
export function NoRealtimeNotice({ className = "" }: { className?: string }) {
  const [empty, setEmpty] = useState(false);
  const [checkedAt, setCheckedAt] = useState<string>("");

  useEffect(() => {
    let cancelled = false;
    const check = async () => {
      try {
        const res = await fetch("/api/gtfs-rt/vehicle-positions?format=json");
        let data: any = null;
        try { data = await res.json(); } catch { data = null; }
        const entities = Array.isArray(data?.entity) ? data.entity : [];
        const gps = Array.isArray(data?.gpsPositions) ? data.gpsPositions : null;
        const withPos = entities.filter((e: any) => e?.vehicle?.position?.latitude);
        const isEmpty = res.ok ? withPos.length === 0 && (!gps || gps.length === 0) : true;
        if (!cancelled) {
          setEmpty(isEmpty);
          setCheckedAt(new Date().toLocaleTimeString("es-ES", { hour: "2-digit", minute: "2-digit", second: "2-digit" }));
        }
      } catch {
        if (!cancelled) setEmpty(true);
      }
    };
    check();
    const id = setInterval(check, 15_000);
    return () => { cancelled = true; clearInterval(id); };
  }, []);

  if (!empty) return null;

  return (
    <div role="status" aria-live="polite" className={`rounded-2xl border border-primary/25 bg-primary/10 p-4 sm:p-5 text-sm ${className}`}>
      <div className="flex items-start gap-3">
        <SatelliteDish className="w-5 h-5 text-primary shrink-0 mt-0.5" aria-hidden />
        <div className="space-y-2">
          <h3 className="font-semibold text-base text-foreground">No hay vehículos transmitiendo datos en tiempo real.</h3>
          <p className="text-muted-foreground">Actualmente, no estamos recibiendo datos de posicionamiento GPS de los autobuses a través del sistema de seguimiento del operador. Por este motivo, no podemos mostrar la ubicación de los vehículos, su movimiento en el mapa ni estimar en tiempo real dónde se encuentran.</p>
          <p className="text-muted-foreground">Esto no significa necesariamente que los autobuses no estén circulando. Es posible que los vehículos estén prestando servicio con normalidad, pero sus equipos de localización no estén transmitiendo datos, que los conductores aún no hayan iniciado sesión en el sistema de a bordo o que exista algún problema de conectividad o comunicación con el servidor que gestiona la información.</p>
          <p className="text-muted-foreground"><strong className="text-foreground">¿Qué puedes hacer?</strong> No es necesario hacer nada. ArroyoBus comprobará automáticamente la disponibilidad de los datos y actualizará el mapa en cuanto se restablezca la transmisión de posiciones.</p>
          <p className="text-muted-foreground">Mientras tanto, puedes seguir consultando los horarios, las rutas y las paradas habituales del servicio.</p>
          <p className="text-xs text-muted-foreground/80">Última comprobación realizada por el sistema{checkedAt ? `: ${checkedAt}` : ""}. La información volverá a estar disponible automáticamente cuando se reciban nuevas posiciones.</p>
        </div>
      </div>
    </div>
  );
}
