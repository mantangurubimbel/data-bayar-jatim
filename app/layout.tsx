import type { Metadata } from "next";
import { Suspense } from "react";
import { AutoLogout } from "@/app/components/auto-logout";
import { NavigationPendingIndicator } from "@/app/components/navigation-pending-indicator";
import "./globals.css";

export const metadata: Metadata = {
  title: "Data Bayar Jawa Timur",
  description: "Dashboard data bayar siswa Jawa Timur",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className="h-full antialiased">
      <body className="min-h-full flex flex-col">
        <Suspense fallback={null}>
          <NavigationPendingIndicator />
        </Suspense>
        <AutoLogout />
        {children}
      </body>
    </html>
  );
}
