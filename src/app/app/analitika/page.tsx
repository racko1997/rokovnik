import { clsx } from "clsx";
import { ArrowDownRight, ArrowUpRight } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { Swatch } from "@/components/ui/swatch";
import { formatDuration, formatLocalDateLong, formatPrice, MONTHS_GENITIVE, plural, WEEKDAYS } from "@/lib/format";
import { requirePagePermission } from "@/server/context";
import { isoWeekday, toLocalDate } from "@/server/domain/time";
import { getReport } from "@/server/services/reports";
import { PRESETS, periodLabel, resolvePeriod } from "./period";
import { type ChartPoint, RevenueChart } from "./revenue-chart";

export const metadata: Metadata = { title: "Analitika" };

const SOURCE: Record<string, string> = {
  dashboard: "Recepcija (upisao salon)",
  online: "Online stranica",
  chat: "AI chat",
  instagram: "Instagram",
  messenger: "Messenger",
  whatsapp: "WhatsApp",
  viber: "Viber",
  voice: "Telefonski recepcioner",
};

type Search = { p?: string; od?: string; do?: string };

export default async function AnalyticsPage({ searchParams }: { searchParams: Promise<Search> }) {
  const { salon } = await requirePagePermission("viewRevenue");
  const sp = await searchParams;
  const today = toLocalDate(new Date(), salon.timezone);
  const period = resolvePeriod(sp, today);
  const r = await getReport(salon, period.from, period.to);
  const money = (c: number) => formatPrice(c, salon.currency);
  const t = r.totals;

  const totalVisits = t.visits + t.upcomingVisits;
  const avg = t.visits ? Math.round(t.revenueCents / t.visits) : 0;
  const prevAvg = r.previous.visits ? Math.round(r.previous.revenueCents / r.previous.visits) : 0;
  const selfShare = t.booked ? Math.round((t.selfBooked / t.booked) * 100) : 0;
  const staffTotal = r.staff.reduce(
    (a, s) => ({
      visits: a.visits + s.visits,
      revenueCents: a.revenueCents + s.revenueCents,
      upcomingCents: a.upcomingCents + s.upcomingCents,
      bookedMin: a.bookedMin + s.bookedMin,
      scheduledMin: a.scheduledMin + s.scheduledMin,
    }),
    { visits: 0, revenueCents: 0, upcomingCents: 0, bookedMin: 0, scheduledMin: 0 },
  );
  const topStaffRevenue = Math.max(...r.staff.map((s) => s.revenueCents + s.upcomingCents), 1);
  const services = r.services.slice(0, 10);
  const topService = Math.max(...services.map((s) => s.revenueCents), 1);
  const sourceTotal = r.sources.reduce((a, s) => a + s.count, 0);

  return (
    <div className="mx-auto max-w-6xl px-4 py-6 sm:px-6 lg:py-10">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-sm text-ink-soft">Analitika</p>
          <h1 className="font-display text-3xl leading-tight sm:text-4xl">{periodLabel(r.from, r.to)}</h1>
        </div>
      </header>

      {/* Period */}
      <div className="mt-5 flex flex-wrap items-center gap-2">
        {PRESETS.map((p) => (
          <Link
            key={p.key}
            href={`/app/analitika?p=${p.key}`}
            className={clsx(
              "rounded-full px-3.5 py-1.5 text-sm ring-1 transition-colors",
              period.key === p.key ? "bg-ink text-porcelain ring-ink" : "bg-paper text-ink-soft ring-line hover:text-ink",
            )}
          >
            {p.label}
          </Link>
        ))}
        <form action="/app/analitika" className="flex flex-wrap items-center gap-1.5 text-sm">
          <input type="hidden" name="p" value="raspon" />
          <input
            type="date"
            name="od"
            defaultValue={r.from}
            aria-label="Od"
            className="h-9 rounded-full bg-paper px-3 ring-1 ring-line focus:ring-2 focus:ring-lacquer focus:outline-none"
          />
          <span className="text-ink-faint">–</span>
          <input
            type="date"
            name="do"
            defaultValue={r.to}
            aria-label="Do"
            className="h-9 rounded-full bg-paper px-3 ring-1 ring-line focus:ring-2 focus:ring-lacquer focus:outline-none"
          />
          <button
            type="submit"
            className={clsx(
              "h-9 rounded-full px-3.5 ring-1 transition-colors",
              period.key === "raspon" ? "bg-ink text-porcelain ring-ink" : "bg-paper text-ink-soft ring-line hover:text-ink",
            )}
          >
            Prikaži
          </button>
        </form>
      </div>

      {/* Glavne brojke */}
      <section className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Tile
          label="Ostvaren prihod"
          value={money(t.revenueCents)}
          delta={delta(t.revenueCents, r.previous.revenueCents)}
          note={t.upcomingCents ? `+ ${money(t.upcomingCents)} zakazano do kraja perioda` : undefined}
        />
        <Tile
          label="Termini"
          value={String(t.visits)}
          delta={delta(t.visits, r.previous.visits)}
          note={t.upcomingVisits ? `+ ${t.upcomingVisits} ${plural(t.upcomingVisits, "zakazan", "zakazana", "zakazanih")} do kraja perioda` : undefined}
        />
        <Tile label="Prosječna posjeta" value={money(avg)} delta={delta(avg, prevAvg)} />
        <Tile
          label="Zakazali sami"
          value={`${selfShare} %`}
          note={`${t.selfBooked} od ${t.booked} termina preko online stranice i AI recepcionera`}
        />
      </section>
      <section className="mt-3 grid grid-cols-3 gap-3">
        <SmallTile label="Novi klijenti" value={r.newClients} />
        <SmallTile label="Otkazano" value={t.cancelled} />
        <SmallTile label="Nisu došli" value={t.noShow} />
      </section>

      {/* Prihod kroz period */}
      <section className="mt-6 rounded-[var(--radius-card)] bg-paper p-5 ring-1 ring-line sm:p-6">
        <h2 className="font-display text-xl">Prihod po {r.daily.length > 45 ? "sedmici" : "danu"}</h2>
        {totalVisits === 0 ? (
          <p className="mt-3 text-ink-soft">U ovom periodu nema termina.</p>
        ) : (
          <div className="mt-4">
            <RevenueChart points={chartPoints(r.daily)} currency={salon.currency} />
          </div>
        )}
      </section>

      {/* Radnici */}
      <section className="mt-6 rounded-[var(--radius-card)] bg-paper ring-1 ring-line">
        <h2 className="px-5 pt-5 font-display text-xl sm:px-6">Po radniku</h2>
        {r.staff.length === 0 ? (
          <p className="px-5 pt-3 pb-5 text-ink-soft sm:px-6">Nema radnika s terminima ili smjenama u ovom periodu.</p>
        ) : (
          <div className="mt-3 overflow-x-auto">
            <table className="w-full min-w-[40rem] text-sm">
              <thead className="text-left text-xs text-ink-faint">
                <tr className="border-b border-line">
                  <th className="px-5 py-2 font-medium sm:px-6">Radnik</th>
                  <th className="px-3 py-2 text-right font-medium">Termini</th>
                  <th className="px-3 py-2 text-right font-medium">Sati rada</th>
                  <th className="px-3 py-2 font-medium">Popunjenost</th>
                  <th className="px-3 py-2 text-right font-medium">Prihod</th>
                  {staffTotal.upcomingCents > 0 && <th className="px-5 py-2 text-right font-medium sm:px-6">Zakazano</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {r.staff.map((s) => {
                  const fill = s.scheduledMin ? Math.min(100, Math.round((s.bookedMin / s.scheduledMin) * 100)) : null;
                  return (
                    <tr key={s.id}>
                      <td className="px-5 py-3 sm:px-6">
                        <span className="flex items-center gap-2 font-medium">
                          <Swatch color={s.color} size="sm" /> {s.name}
                        </span>
                      </td>
                      <td className="px-3 py-3 text-right tabular">{s.visits}</td>
                      <td className="px-3 py-3 text-right whitespace-nowrap tabular">{formatDuration(Math.round(s.bookedMin))}</td>
                      <td className="px-3 py-3">
                        {fill === null ? (
                          <span className="text-ink-faint">bez smjena</span>
                        ) : (
                          <span className="flex items-center gap-2">
                            <span className="h-1.5 w-20 overflow-hidden rounded-full bg-lacquer-wash">
                              <span className="block h-full rounded-full bg-lacquer" style={{ width: `${fill}%` }} />
                            </span>
                            <span className="tabular text-ink-soft">{fill} %</span>
                          </span>
                        )}
                      </td>
                      <td className="px-3 py-3 text-right">
                        <span className="font-semibold tabular">{money(s.revenueCents)}</span>
                        <span className="mt-1 ml-auto block h-1 max-w-28 overflow-hidden rounded-full bg-porcelain">
                          <span className="block h-full rounded-full bg-ink/70" style={{ width: `${(s.revenueCents / topStaffRevenue) * 100}%` }} />
                        </span>
                      </td>
                      {staffTotal.upcomingCents > 0 && (
                        <td className="px-5 py-3 text-right text-ink-soft tabular sm:px-6">{s.upcomingCents ? money(s.upcomingCents) : "—"}</td>
                      )}
                    </tr>
                  );
                })}
              </tbody>
              <tfoot>
                <tr className="border-t border-line-strong font-semibold">
                  <td className="px-5 py-3 sm:px-6">Ukupno</td>
                  <td className="px-3 py-3 text-right tabular">{staffTotal.visits}</td>
                  <td className="px-3 py-3 text-right whitespace-nowrap tabular">{formatDuration(Math.round(staffTotal.bookedMin))}</td>
                  <td className="px-3 py-3 text-ink-soft tabular">
                    {staffTotal.scheduledMin ? `${Math.min(100, Math.round((staffTotal.bookedMin / staffTotal.scheduledMin) * 100))} %` : ""}
                  </td>
                  <td className="px-3 py-3 text-right tabular">{money(staffTotal.revenueCents)}</td>
                  {staffTotal.upcomingCents > 0 && <td className="px-5 py-3 text-right tabular sm:px-6">{money(staffTotal.upcomingCents)}</td>}
                </tr>
              </tfoot>
            </table>
          </div>
        )}
        <p className="px-5 pt-1 pb-5 text-xs text-ink-faint sm:px-6">
          Termini i prihod su ostvareni (termini koji su već počeli). Popunjenost je udio smjena zauzet terminima, uključujući i zakazane.
        </p>
      </section>

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        {/* Usluge */}
        <section className="rounded-[var(--radius-card)] bg-paper p-5 ring-1 ring-line sm:p-6">
          <h2 className="font-display text-xl">Po usluzi</h2>
          {services.length === 0 ? (
            <p className="mt-3 text-ink-soft">Nema termina.</p>
          ) : (
            <ul className="mt-4 space-y-3 text-sm">
              {services.map((s) => (
                <li key={s.name}>
                  <div className="flex items-baseline justify-between gap-3">
                    <span className="min-w-0 truncate">{s.name}</span>
                    <span className="shrink-0 text-ink-soft tabular">
                      {s.count}× · <strong className="font-semibold text-ink">{money(s.revenueCents)}</strong>
                    </span>
                  </div>
                  <span className="mt-1 block h-1 overflow-hidden rounded-full bg-porcelain">
                    <span className="block h-full rounded-full bg-ink/70" style={{ width: `${(s.revenueCents / topService) * 100}%` }} />
                  </span>
                </li>
              ))}
            </ul>
          )}
          {r.services.length > services.length && (
            <p className="mt-3 text-xs text-ink-faint">+ još {r.services.length - services.length} usluga s manjim prihodom</p>
          )}
        </section>

        {/* Kanali */}
        <section className="rounded-[var(--radius-card)] bg-paper p-5 ring-1 ring-line sm:p-6">
          <h2 className="font-display text-xl">Odakle dolaze termini</h2>
          {sourceTotal === 0 ? (
            <p className="mt-3 text-ink-soft">Nema termina.</p>
          ) : (
            <ul className="mt-4 space-y-3 text-sm">
              {r.sources.map((s) => {
                const pct = Math.round((s.count / sourceTotal) * 100);
                return (
                  <li key={s.source}>
                    <div className="flex items-baseline justify-between gap-3">
                      <span>{SOURCE[s.source] ?? s.source}</span>
                      <span className="text-ink-soft tabular">
                        {s.count} · <strong className="font-semibold text-ink">{pct} %</strong>
                      </span>
                    </div>
                    <span className="mt-1 block h-1 overflow-hidden rounded-full bg-porcelain">
                      <span className="block h-full rounded-full bg-ink/70" style={{ width: `${pct}%` }} />
                    </span>
                  </li>
                );
              })}
            </ul>
          )}
        </section>
      </div>

      <p className="mt-6 text-xs text-ink-faint">
        Prihod je po cjenovniku u trenutku zakazivanja; za usluge s cijenom „od“ računa se najniža cijena. Otkazani termini i nedolasci se ne
        računaju u prihod.
      </p>
    </div>
  );
}

function delta(now: number, before: number): number | null {
  if (!before) return null;
  return Math.round(((now - before) / before) * 100);
}

function Tile({ label, value, delta, note }: { label: string; value: string; delta?: number | null; note?: string }) {
  return (
    <div className="rounded-[var(--radius-card)] bg-paper p-5 ring-1 ring-line">
      <p className="text-sm text-ink-soft">{label}</p>
      <p className="mt-1 text-3xl font-semibold tracking-tight tabular">{value}</p>
      {delta !== undefined && delta !== null && (
        <p className={clsx("mt-1 flex items-center gap-1 text-sm", delta >= 0 ? "text-mint" : "text-lacquer-deep")}>
          {delta >= 0 ? <ArrowUpRight size={15} /> : <ArrowDownRight size={15} />}
          {delta >= 0 ? "+" : ""}
          {delta} % <span className="text-ink-faint">od prethodnog perioda</span>
        </p>
      )}
      {note && <p className="mt-1 text-xs text-ink-faint">{note}</p>}
    </div>
  );
}

function SmallTile({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-[var(--radius-card)] bg-paper px-4 py-3 ring-1 ring-line">
      <p className="text-xs text-ink-soft sm:text-sm">{label}</p>
      <p className="text-xl font-semibold tabular">{value}</p>
    </div>
  );
}

/** Dani u stubce; za duge periode po sedmicama da stubci ostanu čitljivi. */
function chartPoints(daily: { date: string; revenueCents: number; upcomingCents: number; visits: number }[]): ChartPoint[] {
  const dayTitle = (d: string) => formatLocalDateLong(d);
  if (daily.length <= 45) {
    return daily.map((d) => ({
      label: daily.length <= 7 ? WEEKDAYS[isoWeekday(d.date) - 1].short : String(Number(d.date.slice(8))),
      title: dayTitle(d.date),
      revenueCents: d.revenueCents,
      upcomingCents: d.upcomingCents,
      visits: d.visits,
    }));
  }
  const weeks: ChartPoint[] = [];
  for (let i = 0; i < daily.length; i += 7) {
    const chunk = daily.slice(i, i + 7);
    const [, m, d] = chunk[0].date.split("-").map(Number);
    weeks.push({
      label: `${d}.${m}.`,
      title: `sedmica od ${d}. ${MONTHS_GENITIVE[m - 1]}`,
      revenueCents: chunk.reduce((a, x) => a + x.revenueCents, 0),
      upcomingCents: chunk.reduce((a, x) => a + x.upcomingCents, 0),
      visits: chunk.reduce((a, x) => a + x.visits, 0),
    });
  }
  return weeks;
}

