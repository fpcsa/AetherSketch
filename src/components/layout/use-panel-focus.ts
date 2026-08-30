import { useEffect, useRef } from 'react';

/** Non-modal panels: enter with focus, Escape to dismiss, then return to the opener. */
export function usePanelFocus(open: boolean, onClose: () => void) {
  const panelRef = useRef<HTMLElement>(null);
  const closeRef = useRef(onClose);
  useEffect(() => {
    closeRef.current = onClose;
  }, [onClose]);
  useEffect(() => {
    const panel = panelRef.current;
    if (!open || !panel) return;
    const opener = document.activeElement;
    const handleKey = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      event.preventDefault();
      event.stopPropagation();
      closeRef.current();
    };
    panel.addEventListener('keydown', handleKey);
    panel
      .querySelector<HTMLElement>('button:not(:disabled), [tabindex="0"]')
      ?.focus();
    return () => {
      panel.removeEventListener('keydown', handleKey);
      if (
        opener instanceof HTMLElement &&
        opener.isConnected &&
        (panel.contains(document.activeElement) ||
          document.activeElement === document.body)
      ) {
        opener.focus();
      }
    };
  }, [open]);
  return panelRef;
}
