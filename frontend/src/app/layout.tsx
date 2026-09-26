import type { Metadata } from "next";
import "./globals.css";
import { AuthProvider } from "@/context/AuthContext";

export const metadata: Metadata = {
  title: "SAMRAT AETHERMIND V3 | Intelligent Multi-Modal AI Platform",
  description: "Building SAMRAT AETHERMIND V3: A Journey Toward an Intelligent Multi-Modal AI Platform. Integrated RAG document chat, real-time voice intelligence, AI image studio, and multi-model routing.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="h-full antialiased dark">
      <body className="min-h-full flex flex-col">
        <AuthProvider>
          {children}
        </AuthProvider>
      </body>
    </html>
  );
}

