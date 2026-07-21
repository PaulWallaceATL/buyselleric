/**
 * Persist last dream preference brief in sessionStorage for listing-detail prefill.
 */

export const DREAM_BRIEF_STORAGE_KEY = "buyselleric:dream-brief";

export type DreamBriefSnapshot = {
  brief: string;
  filters: Record<string, unknown>;
  shortlist: Array<{ mlsId: string; title: string }>;
  savedAt: string;
};

export function writeDreamBriefSnapshot(snapshot: DreamBriefSnapshot): void {
  try {
    sessionStorage.setItem(DREAM_BRIEF_STORAGE_KEY, JSON.stringify(snapshot));
  } catch {
    /* private mode / quota */
  }
}

export function readDreamBriefSnapshot(): DreamBriefSnapshot | null {
  try {
    const raw = sessionStorage.getItem(DREAM_BRIEF_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as DreamBriefSnapshot;
    if (!parsed?.brief || typeof parsed.brief !== "string") return null;
    return parsed;
  } catch {
    return null;
  }
}

export function formatDreamBriefMessage(snapshot: DreamBriefSnapshot): string {
  const lines = [snapshot.brief.trim()];
  if (snapshot.shortlist?.length) {
    lines.push("");
    lines.push("Shortlist:");
    for (const s of snapshot.shortlist.slice(0, 5)) {
      lines.push(`- ${s.title}${s.mlsId ? ` (MLS ${s.mlsId})` : ""}`);
    }
  }
  return lines.join("\n").slice(0, 1500);
}
