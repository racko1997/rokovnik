import type { Metadata } from "next";
import { ButtonLink } from "@/components/ui/button";
import { NewPasswordForm } from "./new-password-form";

export const metadata: Metadata = { title: "Nova lozinka", robots: { index: false } };

export default async function NewPasswordPage({ searchParams }: { searchParams: Promise<{ token?: string; error?: string }> }) {
  const { token, error } = await searchParams;
  if (!token || error) {
    return (
      <>
        <h1 className="font-display text-4xl leading-tight">Link je istekao</h1>
        <p className="mt-2 text-ink-soft">Link za novu lozinku važi 1 sat i može se iskoristiti samo jednom. Zatražite novi.</p>
        <ButtonLink href="/zaboravljena-lozinka" size="lg" className="mt-8 w-full">
          Zatraži novi link
        </ButtonLink>
      </>
    );
  }
  return (
    <>
      <h1 className="font-display text-4xl leading-tight">Nova lozinka</h1>
      <p className="mt-2 text-ink-soft">Najmanje 8 znakova. Nakon promjene odjavićemo vas sa svih ostalih uređaja.</p>
      <NewPasswordForm token={token} />
    </>
  );
}
