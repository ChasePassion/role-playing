import type { Metadata } from "next";
import localFont from "next/font/local";
import "./globals.css";

const inter = localFont({
  src: [
    {
      path: "./fonts/Inter-VariableFont_opsz,wght.ttf",
      style: "normal",
      weight: "100 900",
    },
    {
      path: "./fonts/Inter-Italic-VariableFont_opsz,wght.ttf",
      style: "italic",
      weight: "100 900",
    },
  ],
  variable: "--font-inter",
  display: "swap",
});

const notoSerifSC = localFont({
  src: [
    {
      path: "./fonts/NotoSerifSC-VariableFont_wght.ttf",
      style: "normal",
      weight: "200 900",
    },
  ],
  variable: "--font-noto-serif-sc",
  display: "swap",
});

export const metadata: Metadata = {
  title: "AI 角色扮演",
  description: "与 AI 角色进行对话的虚拟角色扮演平台",
};

import { AuthProvider } from "@/lib/auth-context";

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={`${inter.variable} ${notoSerifSC.variable} antialiased`}>
        <AuthProvider>{children}</AuthProvider>
      </body>
    </html>
  );
}
