import type { Metadata } from "next";
import { can } from "@/lib/permissions";
import { formatPhone } from "@/lib/phone";
import { requirePagePermission } from "@/server/context";
import { listClientsWithStats, type ClientSort } from "@/server/services/clients";
import { ClientsBoard } from "./clients-board";

export const metadata: Metadata = { title: "Klijenti" };

const PAGE = 50;

export default async function ClientsPage({ searchParams }: { searchParams: Promise<{ q?: string; sort?: string; p?: string }> }) {
  const { salon, role } = await requirePagePermission("manageBookings");
  const sp = await searchParams;
  const sort: ClientSort = sp.sort === "name" || sp.sort === "visits" ? sp.sort : "recent";
  const page = Math.max(0, Number(sp.p) || 0);
  const { rows, total } = await listClientsWithStats(salon.id, { q: sp.q, sort, limit: PAGE, offset: page * PAGE });

  return (
    <ClientsBoard
      q={sp.q ?? ""}
      sort={sort}
      page={page}
      pageSize={PAGE}
      total={total}
      currency={salon.currency}
      timezone={salon.timezone}
      showRevenue={can(role, "viewRevenue")}
      clients={rows.map((c) => ({
        ...c,
        phoneDisplay: formatPhone(c.phone),
        createdAt: c.createdAt.toISOString(),
        lastVisit: c.lastVisit?.toISOString() ?? null,
        nextVisit: c.nextVisit?.toISOString() ?? null,
        spentCents: can(role, "viewRevenue") ? c.spentCents : 0,
      }))}
    />
  );
}
