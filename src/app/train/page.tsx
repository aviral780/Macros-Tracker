import type { Metadata } from "next";
import { Suspense } from "react";
import { TrainView } from "@/components/TrainView";

export const metadata: Metadata = { title: "Training" };

export default function Page() {
  return (
    <Suspense>
      <TrainView />
    </Suspense>
  );
}
