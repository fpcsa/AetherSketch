import { useEffect } from 'react';

import { useArchitectureStore } from '../../stores/architecture-store';
import { useWorkspaceUiStore } from '../../stores/workspace-ui-store';

export function PersistenceRecoveryNotice() {
  const unavailable = useArchitectureStore(
    (state) => state.persistenceUnavailable,
  );
  const message = useArchitectureStore(
    (state) => state.persistenceRecoveryNotice,
  );
  const clearMessage = useArchitectureStore(
    (state) => state.clearPersistenceRecoveryNotice,
  );
  const setNotice = useWorkspaceUiStore((state) => state.setNotice);

  useEffect(() => {
    if (!message) {
      return;
    }
    setNotice({ kind: 'error', message });
    clearMessage();
  }, [clearMessage, message, setNotice]);

  return unavailable ? (
    <div
      role="alert"
      className="shrink-0 border-b border-amber-400/30 bg-amber-400/10 px-3 py-2 text-xs text-amber-200"
    >
      Browser storage is unavailable or full. Changes are kept only in this tab.
      Export JSON before closing or reloading.
    </div>
  ) : null;
}
