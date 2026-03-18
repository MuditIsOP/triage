import type { Metadata } from "next";
import { Inter } from "next/font/google";
import { AuthGuard } from "@/components/auth/auth-guard";
import { SessionBoundary } from "@/components/auth/session-boundary";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "ER Triage Management System",
  description: "AI-based emergency room triage and management system foundation",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body className={inter.className}>
        <SessionBoundary>
          <AuthGuard>{children}</AuthGuard>
        </SessionBoundary>
      </body>
    </html>
  );
}
