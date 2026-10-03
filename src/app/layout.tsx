import type { Metadata, Viewport } from "next";
import { Inter, Hind_Siliguri } from "next/font/google";
import "./globals.css";
import { Toaster } from "@/components/ui/toaster";

const inter = Inter({
  variable: "--font-sans",
  subsets: ["latin"],
  display: "swap",
});

const hindSiliguri = Hind_Siliguri({
  variable: "--font-bangla",
  subsets: ["bengali"],
  weight: ["300", "400", "500", "600", "700"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "Sathi (সাথী) — Your Financial Copilot",
  description:
    "AI Hackathon 2026 · Track 03. Cash-flow intelligence, ML shortfall forecasting, safe-to-spend and grounded Bangla copilot for upay wallet users. Every number computed by auditable engines — never by the LLM.",
  keywords: ["Sathi", "upay", "financial copilot", "cash flow", "Bangla", "AI", "hackathon"],
  icons: {
    icon: "data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><rect width='100' height='100' rx='24' fill='%231C1A1A'/><text x='50' y='68' font-size='52' text-anchor='middle' fill='%2306D6A0' font-family='sans-serif' font-weight='bold'>৳</text></svg>",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  themeColor: "#F6F4EE",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body
        className={`${inter.variable} ${hindSiliguri.variable} antialiased bg-background text-foreground`}
        style={{ fontFamily: "var(--font-sans), var(--font-bangla), system-ui, sans-serif" }}
      >
        {children}
        <Toaster />
      </body>
    </html>
  );
}
