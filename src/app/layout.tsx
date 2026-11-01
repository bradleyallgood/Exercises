import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Activity Tracker",
  description: "Starter project: Next.js + TypeScript + a validated API",
};

// LEARNING NOTE: layout.tsx wraps every page below it and persists across
// navigation. It is a Server Component by default (no "use client").
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
