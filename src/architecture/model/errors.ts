import type { JsonObject } from './types';

export type ArchitectureErrorCode =
  | 'COMPONENT_LOCKED'
  | 'COMPONENT_NOT_FOUND'
  | 'EDGE_NOT_FOUND'
  | 'INVALID_CONNECTION'
  | 'DUPLICATE_COMPONENT_ID'
  | 'DUPLICATE_EDGE_ID'
  | 'INVALID_CONFIGURATION'
  | 'INVALID_ARCHITECTURE'
  | 'INVALID_FAILURE_TARGET'
  | 'HISTORY_EMPTY';

type ArchitectureDomainErrorOptions = {
  componentId?: string;
  edgeId?: string;
  details?: JsonObject;
  cause?: unknown;
};

export class ArchitectureDomainError extends Error {
  readonly code: ArchitectureErrorCode;
  readonly componentId?: string;
  readonly edgeId?: string;
  readonly details?: JsonObject;

  constructor(
    code: ArchitectureErrorCode,
    message: string,
    options: ArchitectureDomainErrorOptions = {},
  ) {
    super(message, { cause: options.cause });
    this.name = 'ArchitectureDomainError';
    this.code = code;
    this.componentId = options.componentId;
    this.edgeId = options.edgeId;
    this.details = options.details;
  }
}

export function isArchitectureDomainError(
  error: unknown,
): error is ArchitectureDomainError {
  return error instanceof ArchitectureDomainError;
}
