import { E2CAdminBrand } from "@/components/brand/E2CAdminBrand";
import GridShape from "@/components/common/GridShape";
import ThemeTogglerTwo from "@/components/common/ThemeTogglerTwo";
import { getAdminTranslator } from "@/lib/admin-i18n/server";
import { ThemeProvider } from "@/context/ThemeContext";
import Link from "next/link";
import React from "react";

export default async function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { t } = await getAdminTranslator();

  return (
    <div className="relative p-6 bg-white z-1 dark:bg-gray-900 sm:p-0">
      <ThemeProvider>
        <div className="relative flex lg:flex-row w-full h-screen justify-center flex-col  dark:bg-gray-900 sm:p-0">
          {children}
          <div className="lg:w-1/2 w-full h-full bg-brand-950 dark:bg-white/5 lg:grid items-center hidden">
            <div className="relative items-center justify-center  flex z-1">
              {/* <!-- ===== Common Grid Shape Start ===== --> */}
              <GridShape />
              <div className="flex flex-col items-center max-w-xs">
                <Link href="/" className="block mb-4" aria-label="E2C Admin">
                  <E2CAdminBrand
                    className="justify-center"
                    frameClassName="h-16 w-16 rounded-[22px]"
                    markSize={38}
                    titleClassName="text-lg tracking-[0.28em]"
                    subtitle={t("layout.authBackdropTagline")}
                    subtitleClassName="text-center text-[10px] tracking-[0.3em]"
                  />
                </Link>
              </div>
            </div>
          </div>
          <div className="fixed bottom-6 right-6 z-50 hidden sm:block">
            <ThemeTogglerTwo />
          </div>
        </div>
      </ThemeProvider>
    </div>
  );
}
