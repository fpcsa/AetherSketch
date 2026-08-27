export type WebMcpRegistrationTarget = Pick<
  WebMCP.ModelContext,
  'registerTool'
>;

export function getDocumentModelContext(
  targetDocument: Document = document,
): WebMcpRegistrationTarget | null {
  const context = targetDocument.modelContext;
  return context && typeof context.registerTool === 'function' ? context : null;
}

export function isWebMcpSupported(targetDocument: Document = document) {
  return getDocumentModelContext(targetDocument) !== null;
}
