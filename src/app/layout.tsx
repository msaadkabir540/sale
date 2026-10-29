import type { Metadata } from "next";

import "./globals.css";

export const metadata: Metadata = {
  title: {
    default: "Surf Daily Sales",
    template: "%s · Surf Daily Sales",
  },
  description:
    "Record daily surf shop sales against partners, track line items, and review performance.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-dvh font-sans">{children}</body>
    </html>
  );
}
