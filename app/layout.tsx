import type { Metadata } from "next";
import "./globals.css";
import { ShopProvider } from "@/components/shop-state";

export const metadata: Metadata = {
  title: "RIDEKIT — Equipado para qualquer caminho",
  description: "Capacetes e equipamentos selecionados para cidade, estrada e aventura.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="pt-BR">
      <body><ShopProvider>{children}</ShopProvider></body>
    </html>
  );
}
