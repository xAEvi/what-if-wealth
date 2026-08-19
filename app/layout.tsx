import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { PortfolioProvider } from "@/state/portfolio-context";
import { ToastProvider } from "@/state/toast-context";
import { ThemeProvider } from "@/state/theme-context";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

// Fija data-theme antes del primer pintado para no parpadear al cambiar de tema.
const themeScript = `(function(){try{var t=localStorage.getItem('what-if-wealth.theme');if(t!=='light'&&t!=='dark'){t=window.matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light';}document.documentElement.dataset.theme=t;}catch(e){}})();`;

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
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body className="min-h-full flex flex-col">
        <ThemeProvider>
          <ToastProvider>
            <PortfolioProvider>{children}</PortfolioProvider>
          </ToastProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
