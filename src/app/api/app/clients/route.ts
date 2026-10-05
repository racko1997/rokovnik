import { NextResponse, type NextRequest } from "next/server";
import { formatPhone } from "@/lib/phone";
import { getSalonContext } from "@/server/context";
import { searchClients } from "@/server/services/clients";

/** Pretraga klijenata za recepciju (ime ili broj telefona). */
export async function GET(req: NextRequest) {
  const ctx = await getSalonContext();
  if (!ctx) return NextResponse.json({ error: "Prijava je istekla. Prijavite se ponovo." }, { status: 401 });
  const { salon } = ctx;
  const q = req.nextUrl.searchParams.get("q") ?? "";
  const rows = await searchClients(salon.id, q);
  return NextResponse.json(rows.map((c) => ({ id: c.id, name: c.name, phone: formatPhone(c.phone) })));
}
