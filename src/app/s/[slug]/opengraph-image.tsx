import { ImageResponse } from "next/og";
import { APP_NAME } from "@/lib/brand";
import { formatPrice } from "@/lib/format";
import { ogFonts } from "@/server/og-fonts";
import { listServices } from "@/server/services/catalog";
import { getSalonBySlug } from "@/server/services/salons";

// Kartica kad salon podijeli svoj link za zakazivanje (Instagram bio, Viber, WhatsApp).
export const alt = "Zakažite termin online";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default async function SalonOpengraphImage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const salon = await getSalonBySlug(slug);
  const services = salon ? (await listServices(salon.id)).filter((s) => s.bookableOnline).slice(0, 4) : [];
  const place = [salon?.address, salon?.city].filter(Boolean).join(", ");

  return new ImageResponse(
    (
      <div style={{ display: "flex", flexDirection: "column", width: "100%", height: "100%", background: "#f4f2f6", padding: 72, fontFamily: "Hanken" }}>
        <span style={{ fontSize: 26, color: "#b0174f" }}>Zakažite termin online</span>
        <span style={{ fontFamily: "Young Serif", fontSize: 88, lineHeight: 1.05, color: "#1e1824", marginTop: 14 }}>
          {salon?.name ?? APP_NAME}
        </span>
        {place && <span style={{ fontSize: 28, color: "#5f5668", marginTop: 12 }}>{place}</span>}

        <div style={{ display: "flex", gap: 16, marginTop: "auto" }}>
          {services.map((s) => (
            <div
              key={s.id}
              style={{
                display: "flex",
                flexDirection: "column",
                flex: 1,
                background: "#fcfbfd",
                border: "1px solid #e3dfe8",
                borderRadius: 18,
                padding: "18px 20px",
              }}
            >
              <span style={{ fontSize: 22, color: "#1e1824" }}>{s.name}</span>
              <span style={{ fontSize: 20, color: "#5f5668", marginTop: 6 }}>{formatPrice(s.priceCents, salon!.currency, s.priceFrom)}</span>
            </div>
          ))}
        </div>
        <span style={{ fontSize: 20, color: "#9a92a3", marginTop: 26 }}>Odaberite uslugu i slobodan termin — bez poziva · {APP_NAME}</span>
      </div>
    ),
    { ...size, fonts: await ogFonts() },
  );
}
