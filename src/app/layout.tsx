import type { Metadata } from "next";
import ClientShell from "@/components/layout/ClientShell";
import "../index.css";

export const metadata: Metadata = {
  title: "Padel Arena — Modern Padel Court Booking",
  description: "Pesan lapangan padel modern dengan konfirmasi instan dan jadwal real-time.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="id" suppressHydrationWarning>
      <body className="bg-background text-foreground font-sans antialiased" suppressHydrationWarning>
        <ClientShell>{children}</ClientShell>
      </body>
    </html>
  );
}
