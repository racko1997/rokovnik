/**
 * Boje radnika u kalendaru — po uzoru na paletu boja za kosu (nijansa + broj tona).
 * Ključ se čuva u bazi (`staff.color`), pa se hex može mijenjati bez migracije.
 */
export const SWATCHES = [
  { key: "rubin", tone: "6.66", name: "Rubin", hex: "#A3243F" },
  { key: "bakar", tone: "7.44", name: "Bakar", hex: "#B95A2B" },
  { key: "med", tone: "8.3", name: "Med", hex: "#BE8C2F" },
  { key: "kesten", tone: "5.0", name: "Kesten", hex: "#6E4B3A" },
  { key: "mahagonij", tone: "5.5", name: "Mahagonij", hex: "#7D2E3A" },
  { key: "ljubicasta", tone: "4.2", name: "Ljubičasta", hex: "#6B3F78" },
  { key: "pepeljasta", tone: "9.1", name: "Pepeljasta", hex: "#76829A" },
  { key: "plavocrna", tone: "1.1", name: "Plavo-crna", hex: "#2F3A5C" },
  { key: "sampanjac", tone: "10.13", name: "Šampanjac", hex: "#B79D78" },
  { key: "kadulja", tone: "7.0", name: "Kadulja", hex: "#5F7A64" },
] as const;

export type SwatchKey = (typeof SWATCHES)[number]["key"];

export function swatch(key: string) {
  return SWATCHES.find((s) => s.key === key) ?? SWATCHES[0];
}

/** Prva nijansa koju salon još ne koristi. */
export function nextFreeSwatch(used: string[]): SwatchKey {
  return (SWATCHES.find((s) => !used.includes(s.key)) ?? SWATCHES[used.length % SWATCHES.length]).key;
}
