const DIACRITICS: Record<string, string> = { č: "c", ć: "c", š: "s", đ: "dj", ž: "z" };

/** "Salon Đurđica Čapljina" → "salon-djurdjica-capljina" */
export function slugify(input: string): string {
  return input
    .toLowerCase()
    .replace(/[čćšđž]/g, (c) => DIACRITICS[c] ?? c)
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48);
}
