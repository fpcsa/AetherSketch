import { describe, expect, it, vi } from 'vitest';

import {
  getDocumentModelContext,
  isWebMcpSupported,
  registerWebMcpReadTools,
  type WebMcpRegistrationTarget,
  WEBMCP_READ_TOOL_NAMES,
} from '../../src/webmcp';

function testTools(): WebMCP.ModelContextTool[] {
  return WEBMCP_READ_TOOL_NAMES.map((name) => ({
    name,
    description: `Test ${name}`,
    execute: () => ({ ok: true }),
  }));
}

describe('WebMCP registration boundary', () => {
  it('requires the actual imperative registerTool API for feature detection', () => {
    const registerTool = vi.fn().mockResolvedValue(undefined);
    const supportedDocument = {
      modelContext: { registerTool },
    } as unknown as Document;
    const missingMethodDocument = {
      modelContext: {},
    } as unknown as Document;

    expect(getDocumentModelContext(supportedDocument)).toBe(
      supportedDocument.modelContext,
    );
    expect(isWebMcpSupported(supportedDocument)).toBe(true);
    expect(getDocumentModelContext(missingMethodDocument)).toBeNull();
    expect(isWebMcpSupported(missingMethodDocument)).toBe(false);
    expect(isWebMcpSupported({} as Document)).toBe(false);
  });

  it('registers all four tools and unregisters them through one abort signal', async () => {
    const registrationSignals: AbortSignal[] = [];
    const context: WebMcpRegistrationTarget = {
      registerTool: vi.fn(
        (
          _tool: WebMCP.ModelContextTool,
          options?: WebMCP.ModelContextRegisterToolOptions,
        ) => {
          if (options?.signal) {
            registrationSignals.push(options.signal);
          }
          return Promise.resolve();
        },
      ),
    };
    const controller = new AbortController();
    const registration = await registerWebMcpReadTools(
      context,
      testTools(),
      controller,
    );

    expect(context.registerTool).toHaveBeenCalledTimes(4);
    expect(registration.toolNames).toEqual(WEBMCP_READ_TOOL_NAMES);
    expect(registrationSignals).toHaveLength(4);
    expect(new Set(registrationSignals)).toEqual(new Set([controller.signal]));
    expect(controller.signal.aborted).toBe(false);

    registration.dispose();
    expect(controller.signal.aborted).toBe(true);
  });

  it('aborts every registration when one tool fails', async () => {
    const controller = new AbortController();
    const context: WebMcpRegistrationTarget = {
      registerTool: vi.fn((tool: WebMCP.ModelContextTool) =>
        tool.name === 'inspect_component'
          ? Promise.reject(new Error('duplicate tool'))
          : Promise.resolve(),
      ),
    };

    await expect(
      registerWebMcpReadTools(context, testTools(), controller),
    ).rejects.toThrow('duplicate tool');
    expect(controller.signal.aborted).toBe(true);
  });
});
