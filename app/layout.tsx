import type { Metadata } from "next";
import { IBM_Plex_Sans, IBM_Plex_Mono } from "next/font/google";
import "./globals.css";
import { AppProvider } from "@/lib/store";
import { NavBar } from "@/components/NavBar";

// One deliberate type pair for the whole app, self-hosted so it
// renders identically on every device instead of falling back to
// whatever font each visitor's OS happens to default to.
const plexSans = IBM_Plex_Sans({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-sans",
  display: "swap",
});

const plexMono = IBM_Plex_Mono({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  variable: "--font-mono",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Catalog Quality Auditor",
  description: "AI-powered product catalog audit tool.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${plexSans.variable} ${plexMono.variable} h-full antialiased`}
    >
      <body className="min-h-full bg-ink text-text-primary">
        <AppProvider>
          <NavBar />
          <main>{children}</main>
        </AppProvider>
      </body>
    </html>
  );
}