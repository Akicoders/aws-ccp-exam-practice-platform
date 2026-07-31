"use client";

import { usePathname } from "next/navigation";
import SessionLoading from "@/components/session-loading";

export default function Loading() {
  const pathname = usePathname();
  const label = pathname.startsWith("/es") ? "Cargando..." : "Loading...";

  return <SessionLoading label={label} />;
}
