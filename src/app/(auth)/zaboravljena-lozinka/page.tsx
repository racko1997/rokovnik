import type { Metadata } from "next";
import Link from "next/link";
import { canEmailAnyone } from "@/server/notify";
import { ForgotPasswordForm } from "./forgot-password-form";

export const metadata: Metadata = { title: "Zaboravljena lozinka" };

export default function ForgotPasswordPage() {
  return (
    <>
      <h1 className="font-display text-4xl leading-tight">Zaboravljena lozinka</h1>
      {canEmailAnyone() ? (
        <>
          <p className="mt-2 text-ink-soft">Upišite email s kojim ste otvorili nalog. Poslaćemo vam link za novu lozinku.</p>
          <ForgotPasswordForm />
        </>
      ) : (
        // Dok nema vlastitog domena za slanje, iskreno kažemo kako do nove lozinke
        <p className="mt-4 rounded-[var(--radius-card)] bg-paper px-4 py-3 text-ink-soft ring-1 ring-line">
          Slanje linka mailom još nije uključeno. Javite nam se i postavićemo vam novu lozinku ručno.
        </p>
      )}
      <p className="mt-8 text-sm text-ink-soft">
        Sjetili ste se?{" "}
        <Link href="/prijava" className="font-medium text-lacquer underline-offset-4 hover:underline">
          Nazad na prijavu
        </Link>
      </p>
    </>
  );
}
