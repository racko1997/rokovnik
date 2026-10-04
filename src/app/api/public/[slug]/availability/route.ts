import { NextResponse, type NextRequest } from "next/server";
import { toLocalMinutes } from "@/server/domain/time";
import { DomainError } from "@/server/errors";
import { getAvailability } from "@/server/services/booking";
import { getSalonBySlug } from "@/server/services/salons";

/** Slobodni termini za klijente (poštuje pravila online zakazivanja). */
export async function GET(req: NextRequest, ctx: { params: Promise<{ slug: string }> }) {
  const { slug } = await ctx.params;
  const salon = await getSalonBySlug(slug);
  if (!salon) return NextResponse.json({ error: "Salon ne postoji." }, { status: 404 });

  const p = req.nextUrl.searchParams;
  try {
    const days = await getAvailability(
      salon,
      {
        serviceIds: p.getAll("serviceId"),
        staffId: p.get("staffId") || undefined,
        from: p.get("from") ?? "",
        days: Math.min(31, Number(p.get("days") ?? 14)),
      },
      { mode: "public" },
    );
    return NextResponse.json({
      days: days.map((d) => ({
        date: d.date,
        slots: d.slots.map((s) => ({ startMin: toLocalMinutes(new Date(s.start), salon.timezone), staffIds: s.staffIds })),
      })),
    });
  } catch (err) {
    const message = err instanceof DomainError ? err.message : "Neispravan upit.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
