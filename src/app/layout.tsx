import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "ATELIER Editor",
  description: "Browser-based code editor powered by ATELIER CLI",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="ja">
      <body>{children}</body>
    </html>
  );
}
