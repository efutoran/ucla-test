import type { Metadata, Viewport } from "next";
import Nav from "@/components/Nav";
import VoteCelebration from "@/components/VoteCelebration";
import "./globals.css";

export const metadata: Metadata = {
  title: "'Real' Pitch Event",
  description: "Live investor voting for the 'Real' Pitch Event",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <Nav />
        <main className="mx-auto w-full max-w-3xl px-4 pb-16 pt-4">{children}</main>
        <VoteCelebration />
      </body>
    </html>
  );
}
