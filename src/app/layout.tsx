import type { ReactNode } from "react";
import "./globals.css";

export const metadata = {
  title: "Personas",
  description: "Beautiful, dynamic user persona pages built with Next.js.",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body className="bg-slate-50 min-h-screen antialiased">
        {children}
      </body>
    </html>
  );
}
