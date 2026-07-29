import type { Locale } from "@/types/contracts";
import LocaleLayoutClient from "./locale-layout-client";

export function generateStaticParams() {
  return [{ locale: "en" }, { locale: "es" }];
}

export default function LocaleLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}) {
  return <LocaleLayoutClient params={params}>{children}</LocaleLayoutClient>;
}
