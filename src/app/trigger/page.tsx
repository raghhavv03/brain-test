import { TriggerGame } from "@/components/games/trigger-game";

// Standalone/direct play (dev testing): scored mechanics, run_id null —
// these trials never enter run scoring. The full-sequence flow lives at /test.
export default function TriggerPage() {
  return <TriggerGame />;
}
