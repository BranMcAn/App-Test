import "./globals.css";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Training Discovery",
  description: "Civilian firearms training discovery"
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}