/**
 * Matrículas de la flota ArroyoBus, por vehicleId (id del bus en el feed GTFS-RT).
 */
export const BUS_PLATES: Record<string, string> = {
  "6346": "4772 LKL",
  "6372": "1543 MPD",
  "6386": "0475 NPC",
  "6355": "2575 MHS",
  "6352": "2304 MHS",
};

/** Devuelve la matrícula del bus (con espacio) o null si no consta. */
export function plateFor(vehicleId: string | null | undefined): string | null {
  if (!vehicleId) return null;
  const plate = BUS_PLATES[String(vehicleId).trim()];
  return plate || null;
}
