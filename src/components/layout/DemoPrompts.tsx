import { Check, Clipboard, MessageSquareText, X } from 'lucide-react';
import { useState } from 'react';

import { useWorkspaceUiStore } from '../../stores/workspace-ui-store';

const demoPrompts = [
  'Analyze this architecture for production readiness. Do not modify anything.',
  'Improve the architecture to survive an availability-zone failure while staying under my budget. Keep PostgreSQL.',
  'Simulate the loss of eu-west-1a.',
] as const;

export function DemoPrompts() {
  const [open, setOpen] = useState(false);
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null);
  const setNotice = useWorkspaceUiStore((state) => state.setNotice);

  const copyPrompt = async (prompt: string, index: number) => {
    try {
      if (!navigator.clipboard) {
        throw new Error('Clipboard access is unavailable in this browser.');
      }
      await navigator.clipboard.writeText(prompt);
      setCopiedIndex(index);
      setNotice({ kind: 'success', message: 'Demo prompt copied.' });
      window.setTimeout(() => setCopiedIndex(null), 1800);
    } catch (error) {
      setNotice({
        kind: 'error',
        message:
          error instanceof Error ? error.message : 'Could not copy prompt.',
      });
    }
  };

  return (
    <div className="relative">
      <button
        type="button"
        className="flex h-8 items-center gap-1.5 border border-transparent px-2 text-[11px] font-medium text-slate-500 transition-colors hover:border-slate-700 hover:bg-slate-800 hover:text-slate-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400/80"
        onClick={() => setOpen((current) => !current)}
        aria-label="Demo prompts"
        aria-expanded={open}
        aria-controls="demo-prompts-popover"
        title="Suggested prompts for the three-minute demo"
      >
        <MessageSquareText className="size-3.5" aria-hidden="true" />
        <span className="max-[1320px]:sr-only">Demo prompts</span>
      </button>

      {open ? (
        <section
          id="demo-prompts-popover"
          className="absolute right-0 top-10 z-50 w-[25rem] border border-slate-700 bg-[#0c1118] p-3 shadow-2xl shadow-black/60"
          aria-label="Suggested demo prompts"
        >
          <div className="mb-3 flex items-start gap-2">
            <div>
              <h2 className="text-[12px] font-semibold uppercase tracking-[0.1em] text-slate-300">
                Demo prompts
              </h2>
              <p className="mt-1 text-[11px] leading-4 text-slate-600">
                Copy these into ChatGPT. AetherSketch never sends them or calls
                an LLM.
              </p>
            </div>
            <button
              type="button"
              className="ml-auto grid size-7 shrink-0 place-items-center text-slate-600 hover:text-slate-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400/80"
              onClick={() => setOpen(false)}
              aria-label="Close demo prompts"
            >
              <X className="size-3.5" aria-hidden="true" />
            </button>
          </div>

          <ol className="space-y-2">
            {demoPrompts.map((prompt, index) => (
              <li
                key={prompt}
                className="flex items-start gap-2 border border-slate-800 bg-slate-900/25 p-2.5"
              >
                <span className="grid size-5 shrink-0 place-items-center border border-slate-700 font-mono text-[10px] text-slate-500">
                  {index + 1}
                </span>
                <p className="min-w-0 flex-1 text-[11px] leading-4 text-slate-400">
                  “{prompt}”
                </p>
                <button
                  type="button"
                  className="grid size-7 shrink-0 place-items-center border border-slate-800 text-slate-600 hover:border-cyan-400/30 hover:text-cyan-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400/80"
                  onClick={() => void copyPrompt(prompt, index)}
                  aria-label={`Copy demo prompt ${index + 1}`}
                >
                  {copiedIndex === index ? (
                    <Check
                      className="size-3 text-emerald-400"
                      aria-hidden="true"
                    />
                  ) : (
                    <Clipboard className="size-3" aria-hidden="true" />
                  )}
                </button>
              </li>
            ))}
          </ol>
        </section>
      ) : null}
    </div>
  );
}
