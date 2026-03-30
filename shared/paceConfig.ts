/**
 * shared/paceConfig.ts
 *
 * ══════════════════════════════════════════════════════════════════════════
 *  SINGLE SOURCE OF TRUTH FOR LEARNING BEHAVIOUR PARAMETERS
 * ══════════════════════════════════════════════════════════════════════════
 *
 * To change how students are classified, edit PACE_TIERS below.
 * No other file needs to be touched — both the backend (storage.ts)
 * and the frontend (student-details.tsx, course-details.tsx) import the
 * shared classifyPace() function and PACE_TIERS from here.
 *
 * ── How to adjust thresholds ─────────────────────────────────────────────
 *
 *   Each tier has an `upToHours` field.  The classify function works through
 *   the list in order and returns the first tier whose upper bound is met:
 *
 *     first tier  →  hours  < upToHours   (strict — the boundary hour goes to the NEXT tier)
 *     other tiers →  hours <= upToHours   (inclusive)
 *     last tier   →  upToHours: null      (catches everything that didn't match above)
 *
 *   Current thresholds (all times = total course duration):
 *     Rushing          < 1 hour
 *     Light Engagement 1 – 2 hours
 *     Normal           2 – 3 hours   ← healthy target
 *     Slow             3 – 4 hours
 *     Struggling       > 4 hours
 *     In Progress      course not yet completed
 *
 * ── How to add a tier ────────────────────────────────────────────────────
 *
 *   Insert a new object at the correct position in PACE_TIERS.
 *   Pick a Tailwind colour and fill in color/bg/badge/border.
 *   Set upToHours to the new upper bound (hours).
 *   Update rangeLabel to describe the range (shown in the UI pace card).
 *
 * ── How to remove a tier ─────────────────────────────────────────────────
 *
 *   Delete its entry.  Ensure the remaining upToHours values still form a
 *   complete, non-overlapping range ending with a null entry.
 *
 * ── How to rename a tier ─────────────────────────────────────────────────
 *
 *   Change label and/or rangeLabel.  No other code needs updating.
 */

export interface PaceTier {
  /** Human-readable name shown in badges and breakdowns */
  label: string;
  /** Short time-range description shown in the student pace card (e.g. "2–3 hours") */
  rangeLabel: string;
  /** Upper bound in hours; null = last tier (no upper bound) */
  upToHours: number | null;
  /** Tailwind text-colour class */
  color: string;
  /** Tailwind background class */
  bg: string;
  /** Full badge classes: background + text + border */
  badge: string;
  /** Tailwind border class */
  border: string;
}

// ─── EDIT HERE TO CHANGE BEHAVIOUR ───────────────────────────────────────
export const PACE_TIERS: PaceTier[] = [
  {
    label:      "Rushing",
    rangeLabel: "< 1 hour",
    upToHours:  1,                    // hours < 1
    color:      "text-destructive",
    bg:         "bg-destructive/10",
    badge:      "bg-destructive/10 text-destructive border-destructive/20",
    border:     "border-destructive/20",
  },
  {
    label:      "Light Engagement",
    rangeLabel: "1 – 2 hours",
    upToHours:  2,                    // 1 h ≤ hours ≤ 2 h
    color:      "text-orange-600",
    bg:         "bg-orange-500/10",
    badge:      "bg-orange-500/10 text-orange-600 border-orange-500/20",
    border:     "border-orange-500/20",
  },
  {
    label:      "Normal",
    rangeLabel: "2 – 3 hours",
    upToHours:  3,                    // 2 h < hours ≤ 3 h  ← healthy target
    color:      "text-green-600",
    bg:         "bg-green-500/10",
    badge:      "bg-green-500/10 text-green-700 border-green-500/20",
    border:     "border-green-500/20",
  },
  {
    label:      "Slow",
    rangeLabel: "3 – 4 hours",
    upToHours:  4,                    // 3 h < hours ≤ 4 h
    color:      "text-blue-600",
    bg:         "bg-blue-500/10",
    badge:      "bg-blue-500/10 text-blue-600 border-blue-500/20",
    border:     "border-blue-500/20",
  },
  {
    label:      "Struggling",
    rangeLabel: "> 4 hours",
    upToHours:  null,                 // hours > 4 (no upper bound)
    color:      "text-purple-600",
    bg:         "bg-purple-500/10",
    badge:      "bg-purple-500/10 text-purple-600 border-purple-500/20",
    border:     "border-purple-500/20",
  },
];

/** Returned when the student has not yet completed the course */
export const IN_PROGRESS_PACE: PaceTier = {
  label:      "In Progress",
  rangeLabel: "—",
  upToHours:  null,
  color:      "text-muted-foreground",
  bg:         "bg-muted/30",
  badge:      "bg-muted/30 text-muted-foreground border-muted",
  border:     "border-muted",
};

/**
 * classifyPace
 *
 * Looks up the matching PaceTier for a student's total course duration.
 *
 * @param durationMinutes  Total minutes from enrollment to last course event
 * @param isCompleted      True when the student has finished the course
 * @returns                The matching PaceTier (includes label, colors, rangeLabel)
 */
export function classifyPace(
  durationMinutes: number | undefined,
  isCompleted: boolean,
): PaceTier {
  // Cannot classify until the student has finished
  if (!isCompleted || durationMinutes === undefined) {
    return IN_PROGRESS_PACE;
  }

  const hours = durationMinutes / 60;

  for (let i = 0; i < PACE_TIERS.length; i++) {
    const tier = PACE_TIERS[i];

    // Last tier has no upper bound — everything remaining falls here
    if (tier.upToHours === null) return tier;

    // First tier uses strict < so the boundary value belongs to the next tier
    if (i === 0 && hours < tier.upToHours) return tier;

    // All other tiers use <= (inclusive upper bound)
    if (i > 0 && hours <= tier.upToHours) return tier;
  }

  // Fallback (unreachable if the last tier has upToHours === null)
  return PACE_TIERS[PACE_TIERS.length - 1];
}
