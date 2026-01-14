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
  metadataBase: new URL(process.env.NEXT_PUBLIC_BASE_URL || "https://beyx.vercel.app"),
  title: {
    default: "BeyX System",
    template: "%s | BeyX"
  },
  description: "High performance registration system for Beyblade X",
  openGraph: {
    title: "BeyX System",
    description: "Tournament Registration & Management Platform",
    url: '/',
    siteName: 'BeyX',
    images: [
      {
        url: '/beyx-logo.png',
        width: 800,
        height: 600,
      }
    ],
    locale: 'th_TH',
    type: 'website',
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
        suppressHydrationWarning
      >
        {children}
      </body>
    </html>
  );
}
