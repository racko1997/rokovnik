import { ImageResponse } from "next/og";

// Ikonica za početni ekran telefona i logo u rezultatima pretrage (PNG, 180 px)
export const size = { width: 180, height: 180 };
export const contentType = "image/png";

export default function AppleIcon() {
  return new ImageResponse(
    (
      <div style={{ display: "flex", width: "100%", height: "100%", alignItems: "center", justifyContent: "center", background: "#f4f2f6" }}>
        <div style={{ display: "flex", position: "relative", width: 84, height: 128, borderRadius: 14, background: "#1e1824" }}>
          <div style={{ position: "absolute", left: 14, top: 0, width: 7, height: 128, background: "rgba(244,242,246,0.25)" }} />
          <div style={{ position: "absolute", right: 14, top: -2, width: 20, height: 58, background: "#b0174f", borderBottomLeftRadius: 3, borderBottomRightRadius: 3 }} />
        </div>
      </div>
    ),
    size,
  );
}
