import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "COSTAATT Admissions Letters",
  description: "Admissions letter automation for Banner exports and Word templates."
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
