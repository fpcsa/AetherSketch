import { useEffect } from 'react';

import { useArchitectureStore } from '../../stores/architecture-store';
import { useWorkspaceUiStore } from '../../stores/workspace-ui-store';

export function PersistenceRecoveryNotice() {
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

  return null;
}
