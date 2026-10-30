import "./globals.css";
import type { ReactNode } from "react";
export const metadata = { title: "Mail Bridge AI", description: "Gmail summaries delivered to WhatsApp" };
export default function RootLayout({ children }: { children: ReactNode }) {
  return (<html lang="en"><body>{children}</body></html>);
}
