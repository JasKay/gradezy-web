import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Gradezy — Assessment Operations Intelligence",
  description:
    "Gradezy helps assessment teams reconcile data, catch errors and manage exceptions across the systems they already use.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}