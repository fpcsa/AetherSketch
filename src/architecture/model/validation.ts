import type { ZodError } from 'zod';

import { ArchitectureDomainError } from './errors';
import { architectureSchema } from './schemas';
import type { Architecture, JsonObject } from './types';

function issuesToDetails(error: ZodError): JsonObject {
  return {
    issues: error.issues.map((issue) => ({
      code: issue.code,
      message: issue.message,
      path: issue.path.map(String),
    })),
  };
}

export function validateArchitecture(value: unknown): Architecture {
  const result = architectureSchema.safeParse(value);

  if (!result.success) {
    throw new ArchitectureDomainError(
      'INVALID_ARCHITECTURE',
      'Architecture validation failed.',
      {
        details: issuesToDetails(result.error),
        cause: result.error,
      },
    );
  }

  return result.data;
}

export function cloneArchitecture(architecture: Architecture): Architecture {
  return structuredClone(architecture);
}
