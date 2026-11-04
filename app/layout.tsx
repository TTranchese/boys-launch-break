import type { Metadata, Viewport } from "next";
import "leaflet/dist/leaflet.css";
import "maplibre-gl/dist/maplibre-gl.css";
import "../public/design-system/fonts.css";
import "../public/design-system/tokens.css";
import "./globals.css";

export const metadata: Metadata = {
  title: "Cena in Toscana",
  description: "Pin where everyone is in Tuscany and find the best place to have dinner together.",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  colorScheme: "only light",
  themeColor: "#ffffff",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" data-theme="light">
      <head>
        <link rel="preload" href="/fonts/bricolage-grotesque/BricolageGrotesque-latin-wght.woff2" as="font" type="font/woff2" crossOrigin="anonymous" />
      </head>
      <body>{children}</body>
    </html>
  );
}
