import type { ZodError } from 'zod';

import { ArchitectureDomainError } from './errors';
import { jsonSafetyIssue } from './json-safety';
import { architectureSchema } from './schemas';
import type { Architecture, JsonObject } from './types';

function issuesToDetails(error: ZodError): JsonObject {
  return {
    issues: error.issues.slice(0, 8).map((issue) => ({
      code: issue.code,
      message: issue.message.slice(0, 240),
      path: issue.path.map(String).map((part) => part.slice(0, 128)),
    })),
    issuesTruncated: error.issues.length > 8,
  };
}

export function validateArchitecture(value: unknown): Architecture {
  const safetyIssue = jsonSafetyIssue(value);
  if (safetyIssue) {
    throw new ArchitectureDomainError('INVALID_ARCHITECTURE', safetyIssue);
  }
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
