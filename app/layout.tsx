import type { Metadata, Viewport } from "next";
import { Inter, JetBrains_Mono } from "next/font/google";
import type { ReactNode } from "react";
import { Providers } from "@/components/providers";
import "./globals.css";

const inter = Inter({ subsets: ["latin"], variable: "--font-inter", display: "swap" });
const jetbrains = JetBrains_Mono({ subsets: ["latin"], weight: ["400", "500"], variable: "--font-jetbrains", display: "swap" });

export const metadata: Metadata = {
  title: { default: "TimeFlow", template: "%s · TimeFlow" },
  description: "Projects, tasks and team management.",
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: dark)", color: "#0b0d12" },
    { media: "(prefers-color-scheme: light)", color: "#f6f7f9" },
  ],
  // Must not be pinned to "dark": the meta tag it emits would override the
  // color-scheme the light theme sets in CSS, leaving native form controls dark.
  colorScheme: "light dark",
};

/**
 * Paints the saved theme onto <html> before the first frame. Without this the
 * page renders light, then snaps — on every reload, for every dark-theme user.
 * Kept dependency-free and inlined for that reason; it mirrors lib/preferences.
 */
const THEME_SCRIPT = `(function(){try{
var p=JSON.parse(localStorage.getItem("tf.preferences")||"{}");
var t=p.theme==="light"||p.theme==="dark"?p.theme:p.theme==="system"?(matchMedia("(prefers-color-scheme: light)").matches?"light":"dark"):"light";
var d=document.documentElement;
d.dataset.theme=t;
d.dataset.accent=p.accent||"cyan";
d.dataset.density=p.density||"comfortable";
}catch(e){}})();`;

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    // suppressHydrationWarning: the script above mutates <html> before React hydrates.
    <html
      lang="en"
      className={`${inter.variable} ${jetbrains.variable}`}
      suppressHydrationWarning
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_SCRIPT }} />
      </head>
      <body className="min-h-dvh">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
