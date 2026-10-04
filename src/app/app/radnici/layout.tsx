import { can } from "@/lib/permissions";
import { requireSalon } from "@/server/context";
import { TeamTabs } from "./team-tabs";

export default async function TeamLayout({ children }: { children: React.ReactNode }) {
  const { role } = await requireSalon();
  return (
    <>
      <TeamTabs showAccess={can(role, "manageTeam")} />
      {children}
    </>
  );
}
