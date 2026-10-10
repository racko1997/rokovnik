import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { JsonLd } from "@/components/json-ld";
import { appUrl } from "@/lib/app-url";
import { APP_NAME } from "@/lib/brand";
import { formatPhone } from "@/lib/phone";
import { toLocalDate } from "@/server/domain/time";
import { listServices } from "@/server/services/catalog";
import { canEmailAnyone } from "@/server/notify";
import { getSalonBySlug } from "@/server/services/salons";
import { listStaff } from "@/server/services/staff";
import { BookingFlow } from "./booking-flow";
import { ChatWidget } from "./chat-widget";

type Props = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const salon = await getSalonBySlug((await params).slug);
  if (!salon) return {};
  return {
    title: `${salon.name}${salon.city ? `, ${salon.city}` : ""} — zakažite termin online`,
    description: salon.about ?? `Online zakazivanje termina u salonu ${salon.name}${salon.city ? `, ${salon.city}` : ""}. Odaberite uslugu, radnika i slobodan termin.`,
    alternates: { canonical: `/s/${salon.slug}` },
    // Probni saloni žive 24 sata — ne trebaju u pretragama
    ...(salon.sandboxExpiresAt && { robots: { index: false, follow: false } }),
  };
}

export default async function PublicSalonPage({ params }: Props) {
  const salon = await getSalonBySlug((await params).slug);
  if (!salon) notFound();

  const [services, staff] = await Promise.all([listServices(salon.id, { onlineOnly: true }), listStaff(salon.id)]);
  const bookable = staff.filter((s) => s.bookableOnline);
  const bookableIds = new Set(bookable.map((s) => s.id));

  // Google: salon kao lokalni posao s adresom, telefonom, cjenovnikom i online zakazivanjem
  const url = `${appUrl() || "http://localhost:3100"}/s/${salon.slug}`;
  const structured = {
    "@context": "https://schema.org",
    "@type": "BeautySalon",
    name: salon.name,
    url,
    ...(salon.about && { description: salon.about }),
    ...(salon.phone && { telephone: salon.phone }),
    ...((salon.address || salon.city) && {
      address: {
        "@type": "PostalAddress",
        ...(salon.address && { streetAddress: salon.address }),
        ...(salon.city && { addressLocality: salon.city }),
        addressCountry: "BA",
      },
    }),
    currenciesAccepted: salon.currency,
    hasOfferCatalog: {
      "@type": "OfferCatalog",
      name: "Usluge",
      itemListElement: services.slice(0, 50).map((sv) => ({
        "@type": "Offer",
        itemOffered: { "@type": "Service", name: sv.name },
        priceSpecification: {
          "@type": "PriceSpecification",
          price: (sv.priceCents / 100).toFixed(2),
          priceCurrency: salon.currency,
          ...(sv.priceFrom && { minPrice: (sv.priceCents / 100).toFixed(2) }),
        },
      })),
    },
    potentialAction: { "@type": "ReserveAction", target: url, name: "Zakažite termin" },
  };

  return (
    <div className="min-h-dvh">
      <JsonLd data={structured} />
      <header className="border-b border-line bg-paper/70">
        <div className="mx-auto max-w-5xl px-4 pt-8 pb-6 sm:px-6 sm:pt-12">
          <p className="text-sm text-ink-soft">{[salon.city, salon.address].filter(Boolean).join(" · ")}</p>
          <h1 className="mt-1 font-display text-4xl leading-tight sm:text-5xl">{salon.name}</h1>
          {salon.about && <p className="mt-3 max-w-2xl text-ink-soft">{salon.about}</p>}
          {salon.phone && (
            <a href={`tel:${salon.phone}`} className="tabular mt-3 inline-block text-sm font-medium text-lacquer hover:underline">
              {formatPhone(salon.phone)}
            </a>
          )}
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-4 py-8 sm:px-6">
        <BookingFlow
          emailEnabled={canEmailAnyone()}
          slug={salon.slug}
          today={toLocalDate(new Date(), salon.timezone)}
          currency={salon.currency}
          services={services
            .map((s) => ({ ...s, staffIds: s.staffIds.filter((id) => bookableIds.has(id)) }))
            .filter((s) => s.staffIds.length > 0)
            .map((s) => ({
              id: s.id,
              name: s.name,
              description: s.description,
              categoryName: s.categoryName,
              durationMin: s.durationMin,
              bufferMin: s.bufferMin,
              priceCents: s.priceCents,
              priceFrom: s.priceFrom,
              staffIds: s.staffIds,
            }))}
          staff={bookable.map((s) => ({ id: s.id, name: s.name, title: s.title, color: s.color }))}
        />
      </main>

      <footer className="mx-auto flex max-w-5xl flex-wrap gap-x-5 gap-y-1 px-4 pb-10 text-sm text-ink-faint sm:px-6">
        <span>Zakazivanje: {APP_NAME}</span>
        <Link href="/privatnost" className="hover:text-ink">
          Privatnost
        </Link>
        <Link href="/uslovi" className="hover:text-ink">
          Uslovi
        </Link>
      </footer>

      {/* AI recepcioner — prikazuje se samo kad je OpenAI ključ podešen */}
      {process.env.OPENAI_API_KEY && <ChatWidget slug={salon.slug} salonName={salon.name} />}
    </div>
  );
}
