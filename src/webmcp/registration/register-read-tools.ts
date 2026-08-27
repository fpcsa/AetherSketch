import type { WebMcpRegistrationTarget } from './model-context';

export type WebMcpRegistration = {
  toolNames: string[];
  dispose: () => void;
};

export async function registerWebMcpReadTools(
  context: WebMcpRegistrationTarget,
  tools: readonly WebMCP.ModelContextTool[],
  controller: AbortController = new AbortController(),
): Promise<WebMcpRegistration> {
  try {
    await Promise.all(
      tools.map((tool) =>
        context.registerTool(tool, { signal: controller.signal }),
      ),
    );
  } catch (error) {
    controller.abort();
    throw error;
  }

  return {
    toolNames: tools.map((tool) => tool.name),
    dispose: () => controller.abort(),
  };
}
