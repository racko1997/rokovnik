/**
 * Boje usluga u kalendaru (kao u Lime/Fresha: svaka usluga svoja boja, pa se iz
 * ugla oka vidi "ljubičasto = boja, plavo = šišanje").
 * Odvojeno od boja radnika (paleta za kosu) i bez crvene — ona znači "van smjene".
 * Ključ se čuva u bazi (`services.color`), hex se može mijenjati bez migracije.
 */
export const SERVICE_COLORS = [
  { key: "plava", name: "Plava", hex: "#4F6BD8" },
  { key: "ljubicasta", name: "Ljubičasta", hex: "#8E4FC2" },
  { key: "tirkiz", name: "Tirkiz", hex: "#22948F" },
  { key: "narandzasta", name: "Narandžasta", hex: "#D47A22" },
  { key: "zelena", name: "Zelena", hex: "#3B9558" },
  { key: "orhideja", name: "Orhideja", hex: "#C04FA0" },
  { key: "petrol", name: "Petrol", hex: "#2B78A3" },
  { key: "zlatna", name: "Zlatna", hex: "#B08A17" },
  { key: "indigo", name: "Indigo", hex: "#5F55C9" },
  { key: "koral", name: "Koral", hex: "#DB6A52" },
  { key: "maslina", name: "Maslina", hex: "#76862C" },
  { key: "siva", name: "Siva", hex: "#77757F" },
] as const;

export type ServiceColorKey = (typeof SERVICE_COLORS)[number]["key"];

export function serviceColor(key: string | null | undefined) {
  return SERVICE_COLORS.find((c) => c.key === key) ?? SERVICE_COLORS[0];
}

/** Prva boja koju salon još ne koristi (pa ispočetka). */
export function nextServiceColor(used: (string | null)[]): ServiceColorKey {
  const free = SERVICE_COLORS.find((c) => !used.includes(c.key));
  return (free ?? SERVICE_COLORS[used.length % SERVICE_COLORS.length]).key;
}
