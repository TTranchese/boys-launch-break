import type { Metadata, Viewport } from "next";
import { cookies } from "next/headers";
import "leaflet/dist/leaflet.css";
import "maplibre-gl/dist/maplibre-gl.css";
import "../public/design-system/fonts.css";
import "../public/design-system/tokens.css";
import "./globals.css";
import { I18nProvider } from "@/components/I18nProvider";
import { LOCALE_COOKIE, messagesFor, resolveLocale } from "@/lib/i18n";

const requestLocale = async () => resolveLocale((await cookies()).get(LOCALE_COOKIE)?.value);

export async function generateMetadata(): Promise<Metadata> {
  const { meta } = messagesFor(await requestLocale());
  return { title: meta.title, description: meta.description };
}

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  colorScheme: "only light",
  themeColor: "#ffffff",
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const locale = await requestLocale();
  return (
    <html lang={locale} data-theme="light">
      <head>
        <link rel="preload" href="/fonts/bricolage-grotesque/BricolageGrotesque-latin-wght.woff2" as="font" type="font/woff2" crossOrigin="anonymous" />
      </head>
      <body>
        <I18nProvider initialLocale={locale}>{children}</I18nProvider>
      </body>
    </html>
  );
}
