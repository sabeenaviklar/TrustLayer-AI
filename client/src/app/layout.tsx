import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "TrustLayer | AI Hallucination Detection & Verification SaaS",
  description: "Enterprise grade AI hallucination detection, document evidence verification, and truth scoring engine.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark">
      <body className="antialiased min-h-screen bg-slate-950 text-slate-100">
        {children}
      </body>
    </html>
  );
}
