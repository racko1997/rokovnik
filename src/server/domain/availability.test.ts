import { describe, expect, it } from "vitest";
import { findSlots, isFree, subtractIntervals, type StaffDay } from "./availability";
import { dayBounds, isoWeekday, toLocalMinutes, zonedToUtc } from "./time";

const TZ = "Europe/Sarajevo";
const DATE = "2026-10-05"; // ponedjeljak
const at = (hhmm: string, date = DATE) => {
  const [h, m] = hhmm.split(":").map(Number);
  return zonedToUtc(date, h * 60 + m, TZ).getTime();
};
const iv = (a: string, b: string) => ({ start: at(a), end: at(b) });
const fmt = (t: number) => {
  const m = toLocalMinutes(new Date(t), TZ);
  return `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;
};
const origin = dayBounds(DATE, TZ).start.getTime();

describe("vrijeme", () => {
  it("računa ISO dan u sedmici", () => {
    expect(isoWeekday("2026-10-05")).toBe(1);
    expect(isoWeekday("2026-10-11")).toBe(7);
  });

  it("poštuje prelazak na zimsko vrijeme (25. 10. 2026)", () => {
    // Na dan promjene sat se vraća 03:00 → 02:00, dan traje 25 sati.
    const { start, end } = dayBounds("2026-10-25", TZ);
    expect((end.getTime() - start.getTime()) / 3_600_000).toBe(25);
    expect(toLocalMinutes(zonedToUtc("2026-10-25", 9 * 60, TZ), TZ)).toBe(9 * 60);
  });
});

describe("intervali", () => {
  it("oduzima zauzeto od smjene", () => {
    const free = subtractIntervals([iv("09:00", "17:00")], [iv("10:00", "11:00"), iv("10:30", "12:00")]);
    expect(free.map((f) => [fmt(f.start), fmt(f.end)])).toEqual([
      ["09:00", "10:00"],
      ["12:00", "17:00"],
    ]);
  });
});

describe("findSlots", () => {
  const ana: StaffDay = { staffId: "ana", shifts: [iv("09:00", "12:00")], busy: [iv("10:00", "10:40")] };

  it("vraća termine po mreži i odmah nakon zauzetog", () => {
    const slots = findSlots({ staff: [ana], durationMin: 30, stepMin: 15, gridOrigin: origin });
    expect(slots.map((s) => fmt(s.start))).toEqual([
      "09:00", "09:15", "09:30",
      "10:40", "10:45", "11:00", "11:15", "11:30",
    ]);
  });

  it("ne nudi termin koji prelazi kraj smjene", () => {
    const slots = findSlots({ staff: [ana], durationMin: 90, stepMin: 15, gridOrigin: origin });
    // Jutarnji prozor ima 60 min, popodnevni (10:40–12:00) 80 min
    expect(slots).toHaveLength(0);
  });

  it("poštuje najraniji dozvoljeni početak", () => {
    const slots = findSlots({
      staff: [ana], durationMin: 30, stepMin: 15, gridOrigin: origin, earliest: at("11:05"),
    });
    expect(slots.map((s) => fmt(s.start))).toEqual(["11:15", "11:30"]);
  });

  it("spaja radnike koji su slobodni u isto vrijeme", () => {
    const edin: StaffDay = { staffId: "edin", shifts: [iv("09:30", "10:30")], busy: [] };
    const slots = findSlots({ staff: [ana, edin], durationMin: 30, stepMin: 30, gridOrigin: origin });
    expect(slots.map((s) => [fmt(s.start), s.staffIds])).toEqual([
      ["09:00", ["ana"]],
      ["09:30", ["ana", "edin"]],
      ["10:00", ["edin"]],
      ["10:40", ["ana"]],
      ["11:00", ["ana"]],
      ["11:30", ["ana"]],
    ]);
  });

  it("podijeljena smjena — pauza nije slobodna", () => {
    const split: StaffDay = { staffId: "s", shifts: [iv("08:00", "12:00"), iv("13:00", "16:00")], busy: [] };
    expect(isFree(split, iv("11:30", "12:30"))).toBe(false);
    expect(isFree(split, iv("13:00", "14:00"))).toBe(true);
  });

  it("vrijeme djelovanja: tuđi kratki termin smije biti u rupi", async () => {
    // Radnica zauzeta 10:00–10:30 (npr. feniranje drugog klijenta)
    const mia: StaffDay = { staffId: "mia", shifts: [iv("09:00", "12:00")], busy: [iv("10:00", "10:30")] };
    // Farbanje 90 min: nanošenje 30, djelovanje 30 (slobodna), završetak 30
    const segments = [
      { offsetMin: 0, durationMin: 30 },
      { offsetMin: 60, durationMin: 30 },
    ];
    const withGap = findSlots({ staff: [mia], durationMin: 90, segments, stepMin: 15, gridOrigin: origin });
    expect(withGap.map((s) => fmt(s.start))).toContain("09:30");
    // Bez djelovanja 90 min ne stane prije 10:00
    const noGap = findSlots({ staff: [mia], durationMin: 90, stepMin: 15, gridOrigin: origin });
    expect(noGap.map((s) => fmt(s.start))).not.toContain("09:30");
    expect(noGap.map((s) => fmt(s.start))[0]).toBe("10:30");
  });
});
