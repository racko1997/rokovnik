/**
 * Šabloni usluga za brzo postavljanje salona. Cijene su okvirne (KM) — salon ih
 * prepravlja u čarobnjaku ili kasnije u cjenovniku.
 */
export interface ServiceTemplate {
  name: string;
  durationMin: number;
  price: number;
  priceFrom?: boolean;
  bufferMin?: number;
  /** Vrijeme djelovanja (boja, pramenovi) */
  gapStartMin?: number;
  gapMin?: number;
  /** Usluge koje traže dogovor ne nude se online */
  bookableOnline?: boolean;
}

export interface SalonTemplate {
  key: string;
  label: string;
  description: string;
  category: string;
  services: ServiceTemplate[];
}

export const SALON_TEMPLATES: SalonTemplate[] = [
  {
    key: "zene",
    label: "Frizerski — žene",
    description: "Šišanje, feniranje, boja, pramenovi",
    category: "Žene",
    services: [
      { name: "Žensko šišanje", durationMin: 45, price: 25 },
      { name: "Feniranje", durationMin: 30, price: 12, priceFrom: true },
      { name: "Šišanje i feniranje", durationMin: 60, price: 35, priceFrom: true },
      { name: "Farbanje izrastka", durationMin: 90, price: 50, priceFrom: true, bufferMin: 10, gapStartMin: 30, gapMin: 30 },
      { name: "Farbanje cijele kose", durationMin: 120, price: 70, priceFrom: true, bufferMin: 10, gapStartMin: 40, gapMin: 35 },
      { name: "Pramenovi", durationMin: 150, price: 100, priceFrom: true, bufferMin: 10, gapStartMin: 45, gapMin: 35 },
      { name: "Preliv", durationMin: 45, price: 30, priceFrom: true, gapStartMin: 15, gapMin: 20 },
      { name: "Pranje i njega kose", durationMin: 20, price: 8 },
      { name: "Keratinski tretman", durationMin: 150, price: 120, priceFrom: true, bookableOnline: false },
      { name: "Svečana frizura", durationMin: 60, price: 40, priceFrom: true, bookableOnline: false },
    ],
  },
  {
    key: "barber",
    label: "Barber — muškarci",
    description: "Šišanje, brada, fade",
    category: "Muškarci",
    services: [
      { name: "Muško šišanje", durationMin: 30, price: 15 },
      { name: "Fade", durationMin: 40, price: 18 },
      { name: "Šišanje mašinicom", durationMin: 20, price: 10 },
      { name: "Brada", durationMin: 20, price: 10 },
      { name: "Šišanje i brada", durationMin: 45, price: 22 },
      { name: "Dječije šišanje", durationMin: 20, price: 10 },
    ],
  },
  {
    key: "kozmetika",
    label: "Kozmetički salon",
    description: "Lice, obrve, depilacija",
    category: "Lice i tijelo",
    services: [
      { name: "Čišćenje lica", durationMin: 75, price: 50, bufferMin: 10 },
      { name: "Oblikovanje obrva", durationMin: 20, price: 10 },
      { name: "Farbanje obrva i trepavica", durationMin: 30, price: 15 },
      { name: "Lash lift", durationMin: 60, price: 45 },
      { name: "Depilacija nogu", durationMin: 45, price: 30 },
      { name: "Depilacija nausnica", durationMin: 10, price: 5 },
      { name: "Masaža leđa", durationMin: 30, price: 30 },
    ],
  },
  {
    key: "nokti",
    label: "Nokti",
    description: "Manikir, gel lak, pedikir",
    category: "Nokti",
    services: [
      { name: "Manikir", durationMin: 45, price: 20 },
      { name: "Gel lak", durationMin: 60, price: 30 },
      { name: "Izlivanje noktiju", durationMin: 120, price: 50 },
      { name: "Korekcija noktiju", durationMin: 90, price: 40 },
      { name: "Skidanje gela", durationMin: 20, price: 10 },
      { name: "Pedikir", durationMin: 60, price: 35 },
    ],
  },
];
