import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Gradezy — Assessment Operations Intelligence",
  description:
    "Gradezy connects cohort enrolments, assessment schedules, marker progress, reviewed grades and upload preparation.",
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