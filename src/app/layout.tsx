import type { Metadata } from "next";
import { Outfit } from 'next/font/google';
import './globals.css';
import "flatpickr/dist/flatpickr.css";
import { SidebarProvider } from '@/context/SidebarContext';
import { ThemeProvider } from '@/context/ThemeContext';
import { getAppSettings } from "@/lib/settings/serverSettings";

const outfit = Outfit({
  subsets: ["latin"],
});

export async function generateMetadata(): Promise<Metadata> {
  const settings = await getAppSettings();
  const companyName = settings.companyName?.trim() || "MeterFlow";
  return {
    title: {
      default: companyName,
      template: `%s | ${companyName}`,
    },
  };
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={`${outfit.className} dark:bg-gray-900`}>
        <ThemeProvider>
          <SidebarProvider>{children}</SidebarProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
