import type { Metadata, Viewport } from "next";
import { SiteAnalytics } from "@/components/site-analytics";
import { Hanken_Grotesk, Young_Serif } from "next/font/google";
import { appUrl } from "@/lib/app-url";
import { APP_NAME } from "@/lib/brand";
import "./globals.css";

const hanken = Hanken_Grotesk({
  variable: "--font-hanken",
  subsets: ["latin", "latin-ext"],
  display: "swap",
});

const youngSerif = Young_Serif({
  variable: "--font-young-serif",
  weight: "400",
  subsets: ["latin", "latin-ext"],
  display: "swap",
});

export const metadata: Metadata = {
  // Apsolutne adrese za sliku kartice pri dijeljenju linka
  metadataBase: new URL(appUrl() || "http://localhost:3100"),
  title: { default: APP_NAME, template: `%s · ${APP_NAME}` },
  description: "Zakazivanje termina za frizerske i kozmetičke salone, uz AI recepcionera.",
};

export const viewport: Viewport = {
  themeColor: "#f4f2f6",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="bs" className={`${hanken.variable} ${youngSerif.variable}`}>
      <body className="min-h-dvh">
        {children}
        <SiteAnalytics />
      </body>
    </html>
  );
}
