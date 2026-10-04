import { TeamTabs } from "./team-tabs";

export default function TeamLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <TeamTabs />
      {children}
    </>
  );
}
