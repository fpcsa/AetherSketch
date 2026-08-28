import { ArchitectureDomainError } from '../model/errors';
import { ARCHITECTURE_JSON_LIMITS } from '../model/json-safety';
import type { Architecture } from '../model/types';
import { validateArchitecture } from '../model/validation';

export function serializeArchitecture(architecture: Architecture): string {
  return JSON.stringify(validateArchitecture(architecture), null, 2);
}

export function deserializeArchitecture(serialized: string): Architecture {
  if (serialized.length > ARCHITECTURE_JSON_LIMITS.maxCharacters) {
    throw new ArchitectureDomainError(
      'INVALID_ARCHITECTURE',
      'Architecture JSON exceeds the 4,000,000-character import limit.',
    );
  }
  let parsed: unknown;

  try {
    parsed = JSON.parse(serialized) as unknown;
  } catch (error) {
    throw new ArchitectureDomainError(
      'INVALID_ARCHITECTURE',
      'Architecture JSON could not be parsed.',
      {
        details: {
          reason: error instanceof Error ? error.message : 'Invalid JSON.',
        },
        cause: error,
      },
    );
  }

  return validateArchitecture(parsed);
}
