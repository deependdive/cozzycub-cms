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
  title: "Cozzy Cub CMS",
  description: "Content Management System for Cozzy Cub",
  icons: {
    icon: "https://oeplvizkaitaipopdace.supabase.co/storage/v1/object/public/products/cmssiteico.png",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <head>
        <link
          rel="icon"
          href="https://oeplvizkaitaipopdace.supabase.co/storage/v1/object/public/products/cmssiteico.png"
          type="image/png"
        />
      </head>
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
