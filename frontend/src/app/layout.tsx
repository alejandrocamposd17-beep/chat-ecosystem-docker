import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Chat en tiempo real | Next.js + Laravel",
  description: "Chat con cuentas de usuario y mensajes en tiempo real: Next.js, Laravel y MySQL en Docker",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es" className="h-full antialiased">
      <body className="h-full">{children}</body>
    </html>
  );
}
