import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { shareMetadata, siteOrigin } from '@/lib/share-metadata';

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  metadataBase: new URL(siteOrigin),
  title: {
    default: "BeyX System | เว็บจัดการทัวร์นาเมนต์เบย์เบลด (Beyblade X Tournament)",
    template: "%s | BeyX System",
  },
  description:
    "BeyX System ระบบจัดการแข่งขัน Beyblade X อย่างมืออาชีพ ช่วยสร้างสายการแข่ง (Bracket) จัดการผู้เล่น และสรุปผลทัวร์นาเมนต์เบย์เบลดได้ในเว็บเดียว",
  keywords: [
    "beyx system",
    "beyblade x tournament",
    "เว็บจัดแข่งเบย์เบลด",
    "เว็บจัดการทัวร์นาเมนต์เบย์เบลด",
    "จัดแข่งเบย์เบลด",
    "ระบบจัดแข่งเบย์เบลด",
    "จัดสายแข่งเบย์เบลด",
    "beyblade tournament manager",
    "Beyblade X bracket generator",
    "tournament registration beyblade",
  ],
  openGraph: shareMetadata('BeyX System | ระบบจัดทัวร์นาเมนต์เบย์เบลด Beyblade X', 'สร้างสายแข่ง จัดการผู้เล่น และติดตามผลการแข่งขัน Beyblade X ในเว็บเดียว', '/').openGraph,
  icons: {
    icon: "/bey-x-logo-circle.png",
    shortcut: "/bey-x-logo-circle.png",
    apple: "/bey-x-logo-circle.png",
  },
  twitter: shareMetadata('BeyX System', 'Play. Organize. Compete. ระบบจัดการแข่งขัน Beyblade X', '/').twitter,
};

import { MotionExperience } from "@/components/MotionExperience";
import { Toaster } from "sonner";

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="th">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
        suppressHydrationWarning
      >
        <MotionExperience />
        {children}
        <Toaster theme="dark" position="top-center" />
      </body>
    </html>
  );
}
