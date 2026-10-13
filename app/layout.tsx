import type { Metadata } from "next";
import { Nunito_Sans } from "next/font/google";
import "./globals.css";
import { ShopProvider } from "@/components/shop-state";
import { AuthProvider } from "@/components/auth-state";
import { AdminAuthProvider } from "@/components/admin-state";
import { NavigationTransition } from "@/components/navigation-transition";
import { Suspense } from "react";

const nunito = Nunito_Sans({ subsets: ["latin"], weight: ["400", "600", "700", "800"], variable: "--font-nunito", display: "swap" });

export const metadata: Metadata = {
  metadataBase: new URL(process.env.APP_URL || "http://localhost:3000"),
  title: "Ridekit | Capacetes e equipamentos para moto",
  description: "Capacetes, acessórios e equipamentos para motociclistas com produto original, nota fiscal e troca facilitada.",
  applicationName: "Ridekit",
  openGraph: {type:"website",locale:"pt_BR",siteName:"Ridekit",title:"Ridekit | Capacetes e equipamentos para moto",description:"Capacetes, acessórios e equipamentos para motociclistas com produto original, nota fiscal e troca facilitada."},
  twitter: {card:"summary_large_image",title:"Ridekit | Capacetes e equipamentos para moto",description:"Capacetes, acessórios e equipamentos para motociclistas com produto original, nota fiscal e troca facilitada."},
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="pt-BR" className={nunito.variable}>
      <body suppressHydrationWarning><a href="#conteudo" className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[200] focus:rounded-lg focus:bg-white focus:px-4 focus:py-3 focus:text-sm focus:font-bold focus:text-ink focus:shadow-lg">Pular para o conteúdo</a><AuthProvider><AdminAuthProvider><ShopProvider>{children}<Suspense fallback={null}><NavigationTransition/></Suspense></ShopProvider></AdminAuthProvider></AuthProvider></body>
    </html>
  );
}
