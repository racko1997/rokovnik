import Link from "next/link";
import { BrandMark } from "@/components/brand-mark";
import { APP_NAME, OPERATOR } from "@/lib/brand";

/** Pravne stranice: čitljiv tekst, bez marketinga. */
export default function LegalLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-dvh">
      <header className="mx-auto flex max-w-3xl items-center justify-between px-4 py-5 sm:px-6">
        <BrandMark href="/" />
        <nav className="flex gap-5 text-sm text-ink-soft">
          <Link href="/privatnost" className="hover:text-ink">
            Privatnost
          </Link>
          <Link href="/uslovi" className="hover:text-ink">
            Uslovi
          </Link>
        </nav>
      </header>
      <main className="legal mx-auto max-w-3xl px-4 pt-6 pb-20 sm:px-6">{children}</main>
      <footer className="mx-auto max-w-3xl border-t border-line px-4 py-8 text-sm text-ink-soft sm:px-6">
        {OPERATOR.email ? (
          <>
            Pitanja o podacima:{" "}
            <a href={`mailto:${OPERATOR.email}`} className="text-lacquer underline-offset-4 hover:underline">
              {OPERATOR.email}
            </a>
          </>
        ) : (
          <>
            Pitanja o podacima: pišite nam preko{" "}
            <Link href="/#pilot" className="text-lacquer underline-offset-4 hover:underline">
              forme na naslovnoj
            </Link>
            .
          </>
        )}
        <span className="mt-1 block text-ink-faint">© {new Date().getFullYear()} {APP_NAME}</span>
      </footer>
    </div>
  );
}
