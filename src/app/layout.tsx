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
  title: "Interior Aluminum Quoting Tool",
  description: "Professional quoting tool for interior aluminum doors and windows",
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
      >
        <div className="min-h-screen bg-gray-50 flex flex-col">
          <div className="flex-1">
            {children}
          </div>
          <footer className="bg-gray-100 border-t border-gray-200 py-2 px-4 text-center">
            <p className="text-sm text-gray-600">Door Quoter • Alpha v1.0 • Built with Next.js</p>
          </footer>
        </div>
      </body>
    </html>
  );
}
