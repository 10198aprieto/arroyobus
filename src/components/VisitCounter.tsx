import { useEffect, useState } from "react";
import { Users } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

/** Contador total de visitas: suma 1 por sesión del navegador y muestra el total. */
export default function VisitCounter() {
  const [total, setTotal] = useState<number | null>(null);

  useEffect(() => {
    let cancelled = false;
    const run = async () => {
      try {
        const counted = sessionStorage.getItem("arroyobus-visit-counted");
        if (!counted) {
          const { data, error } = await (supabase as any).rpc("increment_site_visits");
          if (!error && data != null) {
            sessionStorage.setItem("arroyobus-visit-counted", "1");
            if (!cancelled) setTotal(Number(data));
            return;
          }
        }
        const { data } = await (supabase as any).from("site_visit_stats").select("total").eq("id", 1).maybeSingle();
        if (!cancelled && data?.total != null) setTotal(Number(data.total));
      } catch {}
    };
    run();
    return () => { cancelled = true; };
  }, []);

  if (total == null) return null;
  return (
    <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-primary/10 text-primary text-xs font-semibold" title="Visitas totales desde la publicación">
      <Users className="w-3.5 h-3.5" aria-hidden />
      {total.toLocaleString("es-ES")} visitas
    </div>
  );
}
