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
  title: {
    default: "HiTech Exams – DataInn",
    template: "%s | HiTech Exams",
  },
  description:
    "Conduct secure online MCQ exams with real-time proctoring, instant results, and WhatsApp notifications — powered by DataInn.",
  keywords: ["online exam", "MCQ test", "HiTech", "DataInn", "proctored exam", "exam portal"],
  authors: [{ name: "DataInn" }],
  creator: "DataInn",
  metadataBase: new URL(
    process.env.NEXT_PUBLIC_APP_URL ?? "https://exams.datainnovation.co.in"
  ),
  openGraph: {
    title: "HiTech Exams – DataInn",
    description:
      "Conduct secure online MCQ exams with real-time proctoring, instant results, and WhatsApp notifications.",
    url: process.env.NEXT_PUBLIC_APP_URL ?? "https://exams.datainnovation.co.in",
    siteName: "HiTech Exams",
    locale: "en_IN",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "HiTech Exams – DataInn",
    description:
      "Conduct secure online MCQ exams with real-time proctoring, instant results, and WhatsApp notifications.",
  },
  robots: {
    index: false,
    follow: false,
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
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
