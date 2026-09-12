import type { Metadata } from "next";
import { Suspense } from "react";
import { LogView } from "@/components/LogView";

export const metadata: Metadata = { title: "Log food" };

export default function Page() {
  return (
    <Suspense>
      <LogView />
    </Suspense>
  );
}
