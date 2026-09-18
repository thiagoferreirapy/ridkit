import type { Metadata } from "next";
import "./globals.css";
import { ShopProvider } from "@/components/shop-state";
import { AuthProvider } from "@/components/auth-state";
import { AdminAuthProvider } from "@/components/admin-state";
import { NavigationTransition } from "@/components/navigation-transition";
import { Suspense } from "react";

export const metadata: Metadata = {
  metadataBase: new URL(process.env.APP_URL || "http://localhost:3000"),
  title: "RIDEKIT — Equipado para qualquer caminho",
  description: "Capacetes e equipamentos selecionados para cidade, estrada e aventura.",
  applicationName: "Ridekit",
  openGraph: {type:"website",locale:"pt_BR",siteName:"Ridekit",title:"RIDEKIT — Equipado para qualquer caminho",description:"Capacetes e equipamentos selecionados para cidade, estrada e aventura."},
  twitter: {card:"summary_large_image",title:"RIDEKIT — Equipado para qualquer caminho",description:"Capacetes e equipamentos selecionados para cidade, estrada e aventura."},
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="pt-BR">
      <body suppressHydrationWarning><AuthProvider><AdminAuthProvider><ShopProvider>{children}<Suspense fallback={null}><NavigationTransition/></Suspense></ShopProvider></AdminAuthProvider></AuthProvider></body>
    </html>
  );
}
