import { EchoGame } from "@/components/games/echo-game";

// Standalone/direct play (dev testing): scored mechanics, run_id null —
// these trials never enter run scoring. The full-sequence flow lives at /test.
export default function EchoPage() {
  return <EchoGame />;
}
