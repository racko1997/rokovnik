import type { Metadata } from "next";
import Link from "next/link";
import { getSession } from "@/server/context";
import { SignedInNotice } from "../signed-in-notice";
import { SignInForm } from "./sign-in-form";

export const metadata: Metadata = { title: "Prijava" };

// Samo putanje unutar aplikacije (ne "//drugi-sajt" ni pune adrese)
const safeNext = (v?: string) => (v && v.startsWith("/") && !v.startsWith("//") && !v.startsWith("/\\") ? v : "/app");

export default async function SignInPage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const next = safeNext((await searchParams).next);
  const session = await getSession();
  if (session) return <SignedInNotice name={session.user.name} email={session.user.email} intent="login" next={next} />;
  return (
    <>
      <h1 className="font-display text-4xl leading-tight">Dobro došli nazad</h1>
      <p className="mt-2 text-ink-soft">Prijavite se da vidite današnji raspored.</p>
      <SignInForm next={next} />
      <p className="mt-8 text-sm text-ink-soft">
        Nemate nalog?{" "}
        <Link href="/registracija" className="font-medium text-lacquer underline-offset-4 hover:underline">
          Otvorite salon
        </Link>
      </p>
    </>
  );
}
