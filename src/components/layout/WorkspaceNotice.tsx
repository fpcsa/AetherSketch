import { AlertCircle, CheckCircle2, Info, X } from 'lucide-react';
import { useEffect } from 'react';

import { useWorkspaceUiStore } from '../../stores/workspace-ui-store';

export function WorkspaceNotice() {
  const notice = useWorkspaceUiStore((state) => state.notice);
  const setNotice = useWorkspaceUiStore((state) => state.setNotice);

  useEffect(() => {
    if (!notice) {
      return;
    }
    const timer = window.setTimeout(() => setNotice(null), 4500);
    return () => window.clearTimeout(timer);
  }, [notice, setNotice]);

  if (!notice) {
    return null;
  }

  const Icon =
    notice.kind === 'success'
      ? CheckCircle2
      : notice.kind === 'error'
        ? AlertCircle
        : Info;

  return (
    <div
      className={`absolute bottom-16 left-1/2 z-50 flex min-h-10 max-w-lg -translate-x-1/2 items-center gap-2 border px-3 py-2 shadow-xl shadow-black/50 ${
        notice.kind === 'success'
          ? 'border-emerald-400/35 bg-emerald-950/95 text-emerald-200'
          : notice.kind === 'error'
            ? 'border-rose-400/40 bg-rose-950/95 text-rose-200'
            : 'border-cyan-400/35 bg-cyan-950/95 text-cyan-200'
      }`}
      role={notice.kind === 'error' ? 'alert' : 'status'}
    >
      <Icon className="size-3.5 shrink-0" aria-hidden="true" />
      <span className="text-[12px] leading-4">{notice.message}</span>
      <button
        type="button"
        className="ml-1 grid size-6 shrink-0 place-items-center opacity-60 hover:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-current"
        onClick={() => setNotice(null)}
        aria-label="Dismiss notification"
      >
        <X className="size-3" aria-hidden="true" />
      </button>
    </div>
  );
}
