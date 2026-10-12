import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Lung Cancer AI - Classification System",
  description: "AI-Powered CT Image Classification for Lung Cancer Detection",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <link
          href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&display=swap"
          rel="stylesheet"
        />
      </head>
      <body>{children}</body>
    </html>
  );
}
