import type { Metadata } from "next";
import { PageHeader } from "@/components/page-header";
import { assignableRoles } from "@/lib/permissions";
import { requirePagePermission } from "@/server/context";
import { listStaff } from "@/server/services/staff";
import { listTeam } from "@/server/services/team";
import { AccessBoard } from "./access-board";

export const metadata: Metadata = { title: "Pristup" };

export default async function AccessPage() {
  const ctx = await requirePagePermission("manageTeam");
  const [{ members, invites }, staff] = await Promise.all([listTeam(ctx.salon.id), listStaff(ctx.salon.id)]);

  return (
    <>
      <PageHeader
        title="Pristup aplikaciji"
        description="Svaki radnik može imati svoj nalog. Radnici vide sve termine i smjene i upisuju termine; vlasnik i menadžer uz to uređuju usluge, cijene, radnike i postavke."
      />
      <AccessBoard
        currentUserId={ctx.userId}
        currentRole={ctx.role}
        assignable={assignableRoles(ctx.role)}
        staff={staff.map((s) => ({ id: s.id, name: s.name, color: s.color }))}
        members={members.map((m) => ({ ...m, joinedAt: m.joinedAt.toISOString() }))}
        invites={invites.map((i) => ({ ...i, expiresAt: i.expiresAt.toISOString(), createdAt: i.createdAt.toISOString() }))}
      />
    </>
  );
}
