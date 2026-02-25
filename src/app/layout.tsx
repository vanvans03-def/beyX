import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_BASE_URL || "https://www.beyx-system.com"),
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
  openGraph: {
    title: "BeyX System | ระบบจัดทัวร์นาเมนต์เบย์เบลด Beyblade X",
    description:
      "จัดการแข่งขัน Beyblade X ของคุณให้เป็นเรื่องง่าย สร้างสายแข่งอัตโนมัติ จัดการผู้เล่น และสรุปผลได้ในเว็บเดียว",
    url: "https://www.beyx-system.com",
    siteName: "BeyX System",
    images: [
      {
        url: "/og-image.jpg",
        width: 1200,
        height: 630,
        alt: "BeyX System - ระบบจัดการแข่งขัน Beyblade X",
      },
    ],
    locale: "th_TH",
    type: "website",
  },
  icons: {
    icon: "/bey-x-logo-circle.png",
    shortcut: "/bey-x-logo-circle.png",
    apple: "/bey-x-logo-circle.png",
  },
  twitter: {
    card: "summary_large_image",
    title: "BeyX System | ระบบจัดทัวร์นาเมนต์เบย์เบลด Beyblade X",
    description:
      "จัดการแข่งขัน Beyblade X ของคุณให้เป็นเรื่องง่าย สร้างสายแข่งอัตโนมัติ",
    images: ["/og-image.jpg"],
  },
};

import { AOSInit } from "@/components/AOSInit";
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
        <AOSInit />
        {children}
        <Toaster theme="dark" position="top-center" />
      </body>
    </html>
  );
}
