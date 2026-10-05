import { NextResponse, type NextRequest } from "next/server";
import { getSalonContext } from "@/server/context";
import { toLocalMinutes } from "@/server/domain/time";
import { DomainError } from "@/server/errors";
import { getAvailability } from "@/server/services/booking";

/** Slobodni termini za recepciju (bez ograničenja za online klijente). */
export async function GET(req: NextRequest) {
  const ctx = await getSalonContext();
  if (!ctx) return NextResponse.json({ error: "Prijava je istekla. Prijavite se ponovo." }, { status: 401 });
  const { salon } = ctx;
  const p = req.nextUrl.searchParams;
  try {
    const [day] = await getAvailability(
      salon,
      {
        serviceIds: p.getAll("serviceId"),
        staffId: p.get("staffId") || undefined,
        from: p.get("date") ?? "",
      },
      { mode: "staff" },
    );
    return NextResponse.json({
      slots: day.slots.map((s) => ({ startMin: toLocalMinutes(new Date(s.start), salon.timezone), staffIds: s.staffIds })),
    });
  } catch (err) {
    const message = err instanceof DomainError ? err.message : "Neispravan upit.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
