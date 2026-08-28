import { isArchitectureDomainError } from '../../architecture/model';
import { useWorkspaceUiStore } from '../../stores/workspace-ui-store';

/** Event handlers are outside React error boundaries; report failures in the shell. */
export function runWorkspaceAction(
  action: () => unknown,
  failureMessage: string,
): boolean {
  try {
    action();
    return true;
  } catch (error) {
    useWorkspaceUiStore.getState().setNotice({
      kind: 'error',
      message: isArchitectureDomainError(error)
        ? error.message
        : failureMessage,
    });
    return false;
  }
}
