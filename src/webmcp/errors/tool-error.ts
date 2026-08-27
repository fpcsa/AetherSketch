import { z } from 'zod';

import { isArchitectureDomainError } from '../../architecture/model';

export type WebMcpErrorCode =
  | 'INVALID_INPUT'
  | 'EXECUTION_ABORTED'
  | 'INTERNAL_ERROR'
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

export type WebMcpToolError = {
  code: WebMcpErrorCode;
  message: string;
  componentId?: string;
  edgeId?: string;
  details?: unknown;
};

export type WebMcpToolSuccess<T> = { ok: true; data: T };
export type WebMcpToolFailure = { ok: false; error: WebMcpToolError };
export type WebMcpToolResult<T> = WebMcpToolSuccess<T> | WebMcpToolFailure;

export function toWebMcpToolError(
  error: unknown,
  signal?: AbortSignal,
): WebMcpToolError {
  if (signal?.aborted) {
    return {
      code: 'EXECUTION_ABORTED',
      message: 'The WebMCP tool invocation was cancelled.',
    };
  }

  if (error instanceof z.ZodError) {
    return {
      code: 'INVALID_INPUT',
      message: 'Tool input does not match the required schema.',
      details: {
        issues: error.issues.map((issue) => ({
          path: issue.path.map(String).join('.'),
          message: issue.message,
        })),
      },
    };
  }

  if (isArchitectureDomainError(error)) {
    return {
      code: error.code,
      message: error.message,
      componentId: error.componentId,
      edgeId: error.edgeId,
      details: error.details,
    };
  }

  return {
    code: 'INTERNAL_ERROR',
    message:
      error instanceof Error
        ? error.message
        : 'The WebMCP tool could not complete.',
  };
}
