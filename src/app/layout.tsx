import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Sitios Web Express",
  description: "Tu sitio web profesional, armado por ti, listo en minutos.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        {/* Tipografía ochentera: Righteous (display) + Work Sans (texto) */}
        <link
          href="https://fonts.googleapis.com/css2?family=Righteous&family=Work+Sans:wght@400;500;600;700&display=swap"
          rel="stylesheet"
        />
      </head>
      <body style={{ fontFamily: "'Work Sans', system-ui, sans-serif" }}>{children}</body>
    </html>
  );
}
