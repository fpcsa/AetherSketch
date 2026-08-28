import type { CatalogDescriptionMode } from '../stores/workspace-ui-store';

const genericProtocolLabels: Readonly<Record<string, string>> = {
  'AWS Events': 'Events',
  SQS: 'Queue messaging',
};

export function protocolLabel(
  protocol: string | undefined,
  mode: CatalogDescriptionMode,
): string {
  const value = protocol ?? '';
  return mode === 'generic' && Object.hasOwn(genericProtocolLabels, value)
    ? (genericProtocolLabels[value] ?? value)
    : value;
}
