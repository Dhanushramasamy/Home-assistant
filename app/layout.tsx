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
  title: "Home Control - Smart Home Automation",
  description: "Simple & polished smart-home control application with pastel styling and ESP32 direct/gateway control",
  icons: {
    icon: "/appicon.png",
    shortcut: "/appicon.png",
    apple: "/appicon.png",
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
      suppressHydrationWarning
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <head>
        <link rel="icon" type="image/png" href="/appicon.png" />
        <link rel="apple-touch-icon" href="/appicon.png" />
      </head>
      <body
        suppressHydrationWarning
        className="min-h-full flex flex-col bg-slate-50 text-slate-900 selection:bg-teal-500 selection:text-white"
      >
        {children}
      </body>
    </html>
  );
}
