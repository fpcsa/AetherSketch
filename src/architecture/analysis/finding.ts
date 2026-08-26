import type { ArchitectureFinding } from './types';

export function createFinding(
  finding: Omit<ArchitectureFinding, 'deterministic'>,
): ArchitectureFinding {
  return { ...finding, deterministic: true };
}

export function deduplicateFindings(
  findings: readonly ArchitectureFinding[],
): ArchitectureFinding[] {
  const seen = new Set<string>();
  return findings.filter((finding) => {
    if (seen.has(finding.id)) {
      return false;
    }
    seen.add(finding.id);
    return true;
  });
}
