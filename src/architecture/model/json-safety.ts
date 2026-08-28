export type JsonLimits = {
  maxDepth: number;
  maxNodes: number;
  maxCharacters: number;
};

export const ARCHITECTURE_JSON_LIMITS: JsonLimits = {
  maxDepth: 24,
  maxNodes: 150_000,
  maxCharacters: 4_000_000,
};

const reservedKeys = new Set(['__proto__', 'prototype', 'constructor']);

/** Bound traversal before recursive schemas; never evaluate an input getter. */
export function jsonSafetyIssue(
  value: unknown,
  limits: JsonLimits = ARCHITECTURE_JSON_LIMITS,
): string | null {
  let nodes = 0;
  let characters = 0;
  const ancestors = new WeakSet<object>();

  function visit(item: unknown, depth: number): string | null {
    nodes += 1;
    if (nodes > limits.maxNodes || depth > limits.maxDepth) {
      return 'JSON nesting or value count exceeds the supported limit.';
    }
    if (typeof item === 'string') characters += item.length;
    else if (typeof item === 'number') {
      if (!Number.isFinite(item)) return 'JSON numbers must be finite.';
      characters += 24;
    } else characters += 4;
    if (characters > limits.maxCharacters) {
      return 'JSON content exceeds the supported size limit.';
    }
    if (
      item === null ||
      item === undefined ||
      typeof item === 'boolean' ||
      typeof item === 'string' ||
      typeof item === 'number'
    )
      return null;
    if (typeof item !== 'object') return 'Only JSON data is accepted.';

    const prototype: unknown = Object.getPrototypeOf(item);
    if (
      !Array.isArray(item) &&
      prototype !== Object.prototype &&
      prototype !== null
    ) {
      return 'Only plain JSON objects are accepted.';
    }
    if (ancestors.has(item)) return 'Circular JSON data is not supported.';
    ancestors.add(item);
    const keys = Reflect.ownKeys(item);
    if (keys.length + nodes > limits.maxNodes) {
      return 'JSON value count exceeds the supported limit.';
    }
    for (const key of keys) {
      if (Array.isArray(item) && key === 'length') continue;
      if (typeof key !== 'string' || reservedKeys.has(key)) {
        return 'Reserved object keys are not accepted.';
      }
      characters += key.length + 3;
      if (characters > limits.maxCharacters)
        return 'JSON content exceeds the supported size limit.';
      const descriptor = Object.getOwnPropertyDescriptor(item, key)!;
      if (!('value' in descriptor)) return 'JSON accessors are not accepted.';
      const issue = visit(descriptor.value, depth + 1);
      if (issue) return issue;
    }
    ancestors.delete(item);
    return null;
  }

  return visit(value, 0);
}
