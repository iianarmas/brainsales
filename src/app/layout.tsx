import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { AuthProvider } from "@/context/AuthContext";
import { ProductProvider } from "@/context/ProductContext";
import { Toaster } from "sonner";
import { ConfirmModalProvider } from "@/components/ConfirmModal";
import { ErrorBoundary } from "@/components/ErrorBoundary";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "BrainSales - HIM Cold Call Flow",
  description: "Interactive cold calling script by Chris Armas",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${inter.variable} font-sans antialiased`}
        suppressHydrationWarning
      >
        <ErrorBoundary>
          <AuthProvider>
            <ProductProvider>
              <ConfirmModalProvider>{children}</ConfirmModalProvider>
            </ProductProvider>
          </AuthProvider>
        </ErrorBoundary>
        <Toaster
          position="top-center"
          toastOptions={{
            unstyled: false,
            classNames: {
              toast: "!bg-white !border-0 !rounded-xl !shadow-lg",
              title: "!text-foreground !font-medium",
              description: "!text-gray-500",
              success: "!text-primary",
              error: "!text-red-500",
              info: "!text-primary",
              warning: "!text-amber-600",
              actionButton: "!bg-primary !text-white",
            },
          }}
        />
      </body>
    </html>
  );
}
