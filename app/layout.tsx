import type { Metadata } from "next";
import "./globals.css";
export const metadata: Metadata = {
  title: "Gradezy | Assessment automation",
  description: "Reconcile Moodle exports with your Progress Tracker and prepare verified assessment records.",
};
export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en"><body>{children}</body></html>;
}
