import { ImageResponse } from "next/og";
import { APP_NAME } from "@/lib/brand";
import { ogFonts } from "@/server/og-fonts";

// Kartica koja se pojavi kad se link podijeli (Instagram, Viber, WhatsApp, Facebook).
export const alt = `${APP_NAME} — zakazivanje i AI recepcioner za salone`;
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

const BLOCKS = [
  { time: "09:00", name: "Milica K.", what: "Žensko šišanje", color: "#A3243F", h: 92 },
  { time: "10:00", name: "Nikola S.", what: "Muško šišanje", color: "#2F3A5C", h: 64 },
  { time: "10:45", name: "Ivana D.", what: "Farbanje izrastka", color: "#6B3F78", h: 120 },
  { time: "12:30", name: "Haris I.", what: "Šišanje + brada", color: "#5F7A64", h: 76 },
];

export default async function OpengraphImage() {
  return new ImageResponse(
    (
      <div style={{ display: "flex", width: "100%", height: "100%", background: "#f4f2f6", padding: 72, fontFamily: "Hanken" }}>
        <div style={{ display: "flex", flexDirection: "column", justifyContent: "space-between", width: 620 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
            <div style={{ width: 30, height: 38, borderRadius: 5, background: "#1e1824", display: "flex", justifyContent: "flex-end" }}>
              <div style={{ width: 8, height: 14, background: "#b0174f", marginRight: 5, borderBottomLeftRadius: 2, borderBottomRightRadius: 2 }} />
            </div>
            <span style={{ fontFamily: "Young Serif", fontSize: 34, color: "#1e1824" }}>{APP_NAME}</span>
          </div>
          <div style={{ display: "flex", flexDirection: "column", fontFamily: "Young Serif", fontSize: 68, lineHeight: 1.04, color: "#1e1824" }}>
            <span>Ruke su vam</span>
            <span>u tuđoj kosi.</span>
            <span style={{ color: "#b0174f" }}>Termine vodi</span>
            <span style={{ color: "#b0174f" }}>{APP_NAME}.</span>
          </div>
          <span style={{ fontSize: 26, color: "#5f5668" }}>Kalendar i AI recepcioner za salone</span>
        </div>

        <div
          style={{
            display: "flex",
            flexDirection: "column",
            marginLeft: "auto",
            width: 380,
            background: "#fcfbfd",
            borderRadius: 28,
            border: "1px solid #e3dfe8",
            padding: 26,
            gap: 10,
            boxShadow: "0 30px 60px -24px rgba(30,24,36,0.28)",
          }}
        >
          <span style={{ fontFamily: "Young Serif", fontSize: 30, color: "#1e1824", marginBottom: 6 }}>Sutra</span>
          {BLOCKS.map((b) => (
            <div key={b.time} style={{ display: "flex", gap: 14 }}>
              <span style={{ width: 58, fontSize: 18, color: "#9a92a3", paddingTop: 10 }}>{b.time}</span>
              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                  flex: 1,
                  height: b.h,
                  borderRadius: 10,
                  padding: "10px 14px",
                  background: `${b.color}1f`,
                  borderLeft: `5px solid ${b.color}`,
                }}
              >
                <span style={{ fontSize: 21, color: "#1e1824" }}>{b.name}</span>
                {b.h > 70 && <span style={{ fontSize: 17, color: "#5f5668" }}>{b.what}</span>}
              </div>
            </div>
          ))}
        </div>
      </div>
    ),
    {
      ...size,
      fonts: await ogFonts(),
    },
  );
}
