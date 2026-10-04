import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getSession } from "@/server/context";
import { SignInForm } from "./sign-in-form";

export const metadata: Metadata = { title: "Prijava" };

export default async function SignInPage() {
  if (await getSession()) redirect("/app");
  return (
    <>
      <h1 className="font-display text-4xl leading-tight">Dobro došli nazad</h1>
      <p className="mt-2 text-ink-soft">Prijavite se da vidite današnji raspored.</p>
      <SignInForm />
      <p className="mt-8 text-sm text-ink-soft">
        Nemate nalog?{" "}
        <Link href="/registracija" className="font-medium text-lacquer underline-offset-4 hover:underline">
          Otvorite salon
        </Link>
      </p>
    </>
  );
}
