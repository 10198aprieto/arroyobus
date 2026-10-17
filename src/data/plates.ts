// Matrículas de la flota ArroyoBus (número de bus → matrícula)
export const PLATES: Record<string, string> = {
  "6346": "4772LKL",
  "6372": "1543MPD",
  "6386": "0475NPC",
  "6355": "2575MHS",
  "6352": "2304MHS",
};
export const plateFor = (...ids: Array<string | undefined | null>) => {
  for (const id of ids) if (id && PLATES[String(id).replace(/\D/g, "")]) return PLATES[String(id).replace(/\D/g, "")];
  return null;
};
