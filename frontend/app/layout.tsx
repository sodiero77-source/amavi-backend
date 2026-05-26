import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Amavi Operations",
  description: "Medication pass, MAR, and shift handoff workflow",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
