import type { ReactNode } from "react";
import "@/styles/globals.scss";

export const metadata = { title: "Template Importer" };

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
