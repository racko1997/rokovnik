import type { Metadata } from "next";
import Link from "next/link";
import { ROLE_LABEL } from "@/lib/permissions";
import { getSession } from "@/server/context";
import { getInvite } from "@/server/services/team";
import { AcceptInvite } from "./accept-invite";

export const metadata: Metadata = { title: "Pozivnica" };

export default async function InvitePage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const [{ status, invite }, session] = await Promise.all([getInvite(token), getSession()]);

  if (status !== "valid" || !invite) {
    const text = {
      missing: "Ovaj link nije ispravan.",
      used: "Ova pozivnica je već iskorištena.",
      expired: "Ova pozivnica je istekla.",
      valid: "",
    }[status];
    return (
      <>
        <h1 className="font-display text-4xl leading-tight">{text}</h1>
        <p className="mt-2 text-ink-soft">Zatražite novu pozivnicu od vlasnika salona.</p>
        <Link href="/prijava" className="mt-8 inline-block font-medium text-lacquer hover:underline">
          Imam nalog — prijava
        </Link>
      </>
    );
  }

  return (
    <>
      <p className="text-sm font-medium text-lacquer">Pozivnica · {ROLE_LABEL[invite.invite.role]}</p>
      <h1 className="mt-1 font-display text-4xl leading-tight">Pridružite se salonu {invite.salonName}</h1>
      <p className="mt-2 text-ink-soft">
        {invite.staffName ? `Vaša kolona u kalendaru: ${invite.staffName}. ` : ""}
        Vidjećete sve termine i smjene i moći ćete upisivati termine.
      </p>
      <AcceptInvite
        token={token}
        email={invite.invite.email}
        defaultName={invite.staffName ?? ""}
        signedInAs={session ? { name: session.user.name, email: session.user.email } : null}
      />
    </>
  );
}
