import { Suspense } from "react";
import { CoachView } from "@/components/CoachView";

export default function Page() {
  return (
    <Suspense>
      <CoachView />
    </Suspense>
  );
}
