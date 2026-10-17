import type { Metadata } from "next";
import { Libre_Baskerville, Oswald } from "next/font/google";
import "./globals.css";

// The two typefaces of prepamarathon.com; body text uses Verdana, like the site.
const oswald = Oswald({
  variable: "--font-oswald",
  subsets: ["latin"],
  weight: ["500", "600", "700"],
});

const baskerville = Libre_Baskerville({
  variable: "--font-baskerville",
  subsets: ["latin"],
  weight: "400",
  style: "italic",
});

export const metadata: Metadata = {
  title: "PrépaMarathon · Via Sana – Parcours de soins",
  description: "Suivi des parcours de soins coordonnés PrépaMarathon par Via Sana (prototype).",
  robots: { index: false, follow: false },
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="fr" className={`${oswald.variable} ${baskerville.variable} h-full antialiased`}>
      <body className="flex min-h-full flex-col">{children}</body>
    </html>
  );
}
