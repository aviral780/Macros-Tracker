import { Suspense } from "react";
import { TodayView } from "@/components/TodayView";

export default function Page() {
  return (
    <Suspense>
      <TodayView />
    </Suspense>
  );
}
