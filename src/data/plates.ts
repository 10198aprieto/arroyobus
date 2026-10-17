export const BUS_PLATES: Record<string, string> = {
  "6346": "4772LKL",
  "6372": "1543MPD",
  "6386": "0475NPC",
  "6355": "2575MHS",
  "6352": "2304MHS",
};

export function plateFor(id?: string | null): string | null {
  if (!id) return null;
  return BUS_PLATES[String(id).trim()] ?? null;
}
