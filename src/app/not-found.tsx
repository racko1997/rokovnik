import { BrandMark } from "@/components/brand-mark";
import { ButtonLink } from "@/components/ui/button";

export default function NotFound() {
  return (
    <div className="flex min-h-dvh flex-col px-4 py-6 sm:px-10">
      <BrandMark />
      <main className="flex flex-1 flex-col items-start justify-center gap-4 py-16 sm:mx-auto sm:max-w-lg">
        <p className="tabular font-display text-6xl text-lacquer">404</p>
        <h1 className="font-display text-3xl leading-tight">Ova stranica ne postoji</h1>
        <p className="text-ink-soft">Provjerite adresu — možda je u njoj greška u kucanju. Ili se vratite na početak.</p>
        <div className="mt-2 flex flex-wrap gap-3">
          <ButtonLink href="/">Na naslovnu</ButtonLink>
          <ButtonLink href="/app/kalendar" variant="secondary">
            Moj kalendar
          </ButtonLink>
        </div>
      </main>
    </div>
  );
}
