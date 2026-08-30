import { Braces, Settings, UserRound, X } from 'lucide-react';

import type { Actor } from '../../architecture/model';
import { useArchitectureStore } from '../../stores/architecture-store';
import { useWorkspaceUiStore } from '../../stores/workspace-ui-store';
import { usePanelFocus } from './use-panel-focus';

const actorVisuals = {
  human: {
    Icon: UserRound,
    label: 'Human',
    className: 'text-cyan-300',
    rowClassName: 'border-l-cyan-400/35',
  },
  agent: {
    Icon: Braces,
    label: 'Agent',
    className: 'text-violet-300',
    rowClassName: 'border-l-violet-400/40 bg-violet-400/[0.025]',
  },
  system: {
    Icon: Settings,
    label: 'System',
    className: 'text-slate-400',
    rowClassName: 'border-l-slate-600',
  },
} satisfies Record<
  Actor,
  {
    Icon: typeof UserRound;
    label: string;
    className: string;
    rowClassName: string;
  }
>;

export function ActivityDrawer() {
  const open = useWorkspaceUiStore((state) => state.activityOpen);
  const setOpen = useWorkspaceUiStore((state) => state.setActivityOpen);
  const activity = useArchitectureStore((state) => state.activity);
  const panelRef = usePanelFocus(open, () => setOpen(false));

  if (!open) {
    return null;
  }

  return (
    <>
      <button
        type="button"
        className="absolute inset-x-0 bottom-14 top-14 z-30 cursor-default bg-black/20"
        onClick={() => setOpen(false)}
        aria-label="Close activity history"
      />
      <aside
        ref={panelRef}
        className="absolute bottom-16 right-3 top-16 z-40 flex w-[340px] flex-col border border-slate-700 bg-[#0c1118] shadow-2xl shadow-black/60 max-[1280px]:top-28"
        aria-labelledby="activity-title"
      >
        <div className="flex h-10 shrink-0 items-center border-b border-slate-800 px-3">
          <h2
            id="activity-title"
            className="text-[12px] font-semibold uppercase tracking-[0.11em] text-slate-300"
          >
            Activity & history
          </h2>
          <span className="ml-2 text-[10px] text-slate-700">
            {activity.length} entries
          </span>
          <button
            type="button"
            className="ml-auto grid size-7 place-items-center text-slate-600 hover:text-slate-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400/80"
            onClick={() => setOpen(false)}
            aria-label="Close activity history"
          >
            <X className="size-3.5" aria-hidden="true" />
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-auto">
          {activity.length > 0 ? (
            <ol className="divide-y divide-slate-800/70">
              {[...activity].reverse().map((entry) => {
                const visual = actorVisuals[entry.actor];
                const Icon = visual.Icon;
                return (
                  <li
                    key={entry.id}
                    className={`flex gap-2.5 border-l-2 px-3 py-3 ${
                      entry.action === 'webmcp.action.blocked'
                        ? 'border-l-rose-400 bg-rose-400/[0.04]'
                        : visual.rowClassName
                    }`}
                  >
                    <div className="grid size-7 shrink-0 place-items-center border border-slate-800 bg-slate-900/50">
                      <Icon
                        className={`size-3.5 ${visual.className}`}
                        aria-hidden="true"
                      />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-start gap-2">
                        <p className="min-w-0 flex-1 break-words text-[12px] leading-4 text-slate-300">
                          {entry.summary}
                        </p>
                        {entry.action === 'webmcp.action.blocked' ? (
                          <span className="shrink-0 border border-rose-400/30 bg-rose-400/8 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-[0.08em] text-rose-300">
                            Blocked
                          </span>
                        ) : null}
                      </div>
                      <div className="mt-1 flex items-center gap-2 text-[10px] uppercase tracking-[0.08em] text-slate-700">
                        <span>{visual.label}</span>
                        <span aria-hidden="true">·</span>
                        <time dateTime={entry.timestamp}>
                          {new Date(entry.timestamp).toLocaleString(undefined, {
                            hour: '2-digit',
                            minute: '2-digit',
                            second: '2-digit',
                            month: 'short',
                            day: 'numeric',
                          })}
                        </time>
                      </div>
                    </div>
                  </li>
                );
              })}
            </ol>
          ) : (
            <div className="grid h-full min-h-48 place-items-center p-6 text-center">
              <div>
                <Settings
                  className="mx-auto size-5 text-slate-700"
                  aria-hidden="true"
                />
                <p className="mt-3 text-[12px] text-slate-500">
                  No architecture changes yet.
                </p>
                <p className="mt-1 text-[11px] text-slate-700">
                  Human, agent, and system actions appear here.
                </p>
              </div>
            </div>
          )}
        </div>
      </aside>
    </>
  );
}
