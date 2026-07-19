import type { Metadata } from "next";
import { Plus_Jakarta_Sans } from "next/font/google";
import "./globals.css";
import { AppProvider } from "@/lib/store";
import { NavBar } from "@/components/NavBar";

// One deliberate typeface for the entire app, self-hosted so it
// renders identically on every device instead of falling back to
// whatever font each visitor's OS happens to default to. Hierarchy
// comes from size/weight/letter-spacing (see globals.css), not from
// switching font families — mixing a monospace label font in next to
// this one read as visually inconsistent, not intentional.
const plusJakartaSans = Plus_Jakarta_Sans({
  subsets: ["latin"],
  variable: "--font-sans",
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
      className={`${plusJakartaSans.variable} h-full antialiased`}
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