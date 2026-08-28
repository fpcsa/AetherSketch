import { z } from 'zod';

import { isArchitectureDomainError } from '../../architecture/model';

export type WebMcpErrorCode =
  | 'INVALID_INPUT'
  | 'EXECUTION_ABORTED'
  | 'INTERNAL_ERROR'
  | 'EDIT_MODE_DISABLED'
  | 'HUMAN_ACTION_REQUIRED'
  | 'TOOL_UNAVAILABLE'
  | 'COMPONENT_LOCKED'
  | 'COMPONENT_NOT_FOUND'
  | 'EDGE_NOT_FOUND'
  | 'INVALID_CONNECTION'
  | 'DUPLICATE_COMPONENT_ID'
  | 'DUPLICATE_EDGE_ID'
  | 'INVALID_CONFIGURATION'
  | 'CONSTRAINT_VIOLATION'
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

type WebMcpExecutionErrorOptions = {
  componentId?: string;
  edgeId?: string;
  details?: unknown;
};

/** Errors enforced by the WebMCP authority boundary rather than the IR. */
export class WebMcpExecutionError extends Error {
  readonly code: WebMcpErrorCode;
  readonly componentId?: string;
  readonly edgeId?: string;
  readonly details?: unknown;

  constructor(
    code: WebMcpErrorCode,
    message: string,
    options: WebMcpExecutionErrorOptions = {},
  ) {
    super(message);
    this.name = 'WebMcpExecutionError';
    this.code = code;
    this.componentId = options.componentId;
    this.edgeId = options.edgeId;
    this.details = options.details;
  }
}

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
        issues: error.issues.slice(0, 8).map((issue) => ({
          path: issue.path.map(String).join('.').slice(0, 160),
          message: issue.message.slice(0, 240),
        })),
        issuesTruncated: error.issues.length > 8,
      },
    };
  }

  if (error instanceof WebMcpExecutionError) {
    return {
      code: error.code,
      message: error.message,
      componentId: error.componentId,
      edgeId: error.edgeId,
      details: error.details,
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
      'The WebMCP tool could not complete. Retry or ask the human to inspect the workspace.',
  };
}
