import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { PortfolioProvider } from "@/state/portfolio-context";
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
  title: "What If Wealth",
  description: "Portfolio visualizer with counterfactual simulations",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        <PortfolioProvider>{children}</PortfolioProvider>
      </body>
    </html>
  );
}
