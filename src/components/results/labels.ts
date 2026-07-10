import type { DomainKey } from "@/lib/scoring/types";

/**
 * User-facing names for the five domains — same wording as the sequence
 * wrapper's intro list ("measures" column), so the results screen never
 * introduces a new term for something the user just played.
 */
export const DOMAIN_LABELS: Record<DomainKey, string> = {
  speed: "Processing speed",
  impulse_control: "Impulse control",
  working_memory: "Working memory",
  flexibility: "Task switching",
  divided_attention: "Divided attention",
};
