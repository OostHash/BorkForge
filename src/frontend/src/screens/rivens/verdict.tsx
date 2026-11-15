import { verdictLevel, verdictShort, type VerdictLevel } from "../../domain/rivens";
import { Badge, type Tone } from "../../primitives/display";

const TONE: Readonly<Record<VerdictLevel, Tone>> = { great: "success", good: "info", mediocre: "warning", bad: "danger" };

/** Verdict as text in a coloured badge (colour never alone). */
export function VerdictBadge({ verdict, short = false, score }: { verdict: string; short?: boolean; score?: number }) {
  return (
    <Badge tone={TONE[verdictLevel(verdict)]} size="md">
      {short ? verdictShort(verdict) : verdict}
      {score !== undefined && ` · ${String(Math.round(score * 100))}%`}
    </Badge>
  );
}

export const scoreTone = (score: number): Tone => (score >= 0.8 ? "success" : score >= 0.6 ? "info" : score >= 0.4 ? "warning" : "danger");
