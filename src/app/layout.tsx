import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { AuthProvider } from "@/context/AuthContext";
import { ProductProvider } from "@/context/ProductContext";
import { Toaster } from "sonner";
import { ConfirmModalProvider } from "@/components/ConfirmModal";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { ThemeProvider } from "@/components/ThemeProvider";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "BrainSales",
  description: "Interactive cold calling script by Chris Armas",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `
              (function() {
                try {
                  var storage = localStorage.getItem('brainsales-theme-storage');
                  if (storage) {
                    var state = JSON.parse(storage).state;
                    if (state.theme) {
                      document.documentElement.setAttribute('data-theme', state.theme);
                    }
                    if (state.primaryColor) {
                      document.documentElement.style.setProperty('--primary', state.primaryColor);
                    }
                  }
                } catch (e) {}
              })();
            `,
          }}
        />
      </head>
      <body
        className={`${inter.variable} font-sans antialiased`}
        suppressHydrationWarning
      >
        <ErrorBoundary>
          <AuthProvider>
            <ProductProvider>
              <ThemeProvider>
                <ConfirmModalProvider>{children}</ConfirmModalProvider>
              </ThemeProvider>
            </ProductProvider>
          </AuthProvider>
        </ErrorBoundary>
        <Toaster
          position="top-center"
          toastOptions={{
            unstyled: false,
            classNames: {
              toast: "!bg-surface-elevated !border !border-border-subtle !rounded-xl !shadow-lg",
              title: "!text-foreground !font-medium",
              description: "!text-text-secondary",
              success: "!text-success",
              error: "!text-destructive",
              info: "!text-info",
              warning: "!text-warning",
              actionButton: "!bg-primary !text-primary-foreground",
            },
          }}
        />
      </body>
    </html>
  );
}
