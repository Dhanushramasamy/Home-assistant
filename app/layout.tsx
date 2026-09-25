import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";

// SF Pro is used on Apple devices; Inter is the closest fallback elsewhere.
const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "Home Control - Smart Home Automation",
  description: "Polished smart-home control application with 3D interactive graphics & ESP32 direct/gateway control",
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
      className={`${inter.variable} h-full antialiased`}
    >
      <head>
        <link rel="icon" type="image/png" href="/appicon.png" />
        <link rel="apple-touch-icon" href="/appicon.png" />
      </head>
      <body
        suppressHydrationWarning
        className="min-h-full flex flex-col bg-canvas text-ink font-sans"
      >
        {children}
      </body>
    </html>
  );
}
