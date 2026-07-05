import { Button } from "@/components/ui/button";

export default function Home() {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-6 bg-background px-6 py-24 text-center text-foreground">
      <p className="text-sm font-medium text-muted-foreground">
        Cognitive Brain Test
      </p>
      <h1 className="text-3xl font-semibold tracking-tight">
        Design tokens are wired up.
      </h1>
      <Button>Take the Brain Test</Button>

      <div className="lab mt-12 flex w-full max-w-md flex-col items-center gap-4 rounded-2xl bg-background p-10 text-foreground">
        <p className="text-sm font-medium text-muted-foreground">
          Lab preview
        </p>
        <p className="text-lg font-semibold">Performance Lab theme</p>
        <Button>Start Trigger</Button>
      </div>
    </div>
  );
}
