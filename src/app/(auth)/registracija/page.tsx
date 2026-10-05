import type { Metadata } from "next";
import Link from "next/link";
import { getSession } from "@/server/context";
import { SignedInNotice } from "../signed-in-notice";
import { SignUpForm } from "./sign-up-form";

export const metadata: Metadata = { title: "Otvorite salon" };

export default async function SignUpPage() {
  const session = await getSession();
  if (session) return <SignedInNotice name={session.user.name} email={session.user.email} intent="signup" />;
  return (
    <>
      <h1 className="font-display text-4xl leading-tight">Otvorite svoj salon</h1>
      <p className="mt-2 text-ink-soft">Prvo vaš nalog, zatim salon, radnici i usluge.</p>
      <SignUpForm />
      <p className="mt-8 text-sm text-ink-soft">
        Već imate nalog?{" "}
        <Link href="/prijava" className="font-medium text-lacquer underline-offset-4 hover:underline">
          Prijavite se
        </Link>
      </p>
    </>
  );
}
