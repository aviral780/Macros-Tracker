import Link from "next/link";
import { notFound } from "next/navigation";
import { ExerciseCoach } from "@/components/ExerciseCoach";
import { ExerciseProgress } from "@/components/ExerciseProgress";
import { Icon } from "@/components/Icon";
import { getExerciseProgress } from "@/lib/queries";

export const dynamic = "force-dynamic";

export async function generateMetadata(props: PageProps<"/train/exercise/[id]">) {
  const data = getExerciseProgress(Number((await props.params).id));
  return { title: data?.exercise.name ?? "Exercise" };
}

export default async function Page(props: PageProps<"/train/exercise/[id]">) {
  const data = getExerciseProgress(Number((await props.params).id));
  if (!data) notFound();
  return (
    <div className="animate-fade">
      <Link href="/train" className="mb-3 inline-flex items-center gap-1 text-[14px] font-semibold text-ink-2 hover:text-ink">
        <Icon name="left" size={16} />
        Training
      </Link>
      <p className="eyebrow">{data.exercise.muscle}</p>
      <h1 className="condensed mb-5 text-[34px] font-black leading-tight">{data.exercise.name}</h1>
      <div className="grid gap-5">
        <ExerciseCoach exerciseId={data.exercise.id} />
        <ExerciseProgress history={data.history} pr={data.pr} />
      </div>
    </div>
  );
}
