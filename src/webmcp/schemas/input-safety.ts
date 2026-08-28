import { jsonSafetyIssue } from '../../architecture/model/json-safety';
import { WebMcpExecutionError } from '../errors/tool-error';

export function assertSafeToolInput(input: unknown): void {
  const issue = jsonSafetyIssue(input, {
    maxDepth: 8,
    maxNodes: 256,
    maxCharacters: 16_384,
  });
  if (issue) throw new WebMcpExecutionError('INVALID_INPUT', issue);
}
