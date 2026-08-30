export function formatScore(score: number | null | undefined): string {
  return score === null ? 'Not assessed' : (score?.toString() ?? '—');
}
