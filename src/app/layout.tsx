import type { Metadata } from "next";

import "./globals.css";

export const metadata: Metadata = {
  title: {
    default: "Darwaesh Khata",
    template: "%s · Darwaesh Khata",
  },
  description:
    "Record daily sales against partners, track line items, and review performance in Darwaesh Khata.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-dvh font-sans">{children}</body>
    </html>
  );
}
