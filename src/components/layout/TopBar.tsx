import {
  Boxes,
  Download,
  History,
  Moon,
  Redo2,
  RotateCcw,
  Sun,
  Undo2,
  Upload,
} from 'lucide-react';
import { useRef, type ChangeEvent } from 'react';

import {
  deserializeArchitecture,
  serializeArchitecture,
} from '../../architecture/serialization';
import { isArchitectureDomainError } from '../../architecture/model';
import {
  architectureTemplateIds,
  type ArchitectureTemplateId,
} from '../../templates';
import { useArchitectureStore } from '../../stores/architecture-store';
import { useIntelligenceStore } from '../../stores/intelligence-store';
import { useThemeStore } from '../../stores/theme-store';
import { useWorkspaceUiStore } from '../../stores/workspace-ui-store';
import { useWebMcpStore } from '../../webmcp';
import { WebMcpStatus } from '../agent/WebMcpStatus';
import { DemoPrompts } from './DemoPrompts';
import { runWorkspaceAction } from './workspace-actions';

const iconButtonClass =
  'grid size-8 place-items-center border border-transparent text-slate-500 transition-colors enabled:hover:border-slate-700 enabled:hover:bg-slate-800 enabled:hover:text-slate-200 disabled:cursor-not-allowed disabled:opacity-35 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400/80';

const templateLabels: Record<ArchitectureTemplateId, string> = {
  'ecommerce-production': 'Ecommerce Production',
  'serverless-api': 'Serverless API',
  'event-processing': 'Event Processing',
};

function safeFilename(name: string): string {
  const normalized = name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
  return `${normalized || 'architecture'}.json`;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function describeImportError(error: unknown): string {
  if (!isArchitectureDomainError(error)) {
    return 'The file could not be read or imported.';
  }

  const issues = error.details?.issues;
  const firstIssue = Array.isArray(issues) ? issues[0] : undefined;
  if (!isRecord(firstIssue)) {
    return error.message;
  }

  const issueMessage =
    typeof firstIssue.message === 'string' ? firstIssue.message : undefined;
  const issuePath = Array.isArray(firstIssue.path)
    ? firstIssue.path.filter((item) => typeof item === 'string').join('.')
    : '';

  return issueMessage
    ? `${error.message} ${issuePath ? `${issuePath}: ` : ''}${issueMessage}`
    : error.message;
}

export function TopBar() {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const architecture = useArchitectureStore((state) => state.architecture);
  const canUndo = useArchitectureStore((state) => state.past.length > 0);
  const canRedo = useArchitectureStore((state) => state.future.length > 0);
  const activityCount = useArchitectureStore((state) => state.activity.length);
  const undo = useArchitectureStore((state) => state.undo);
  const redo = useArchitectureStore((state) => state.redo);
  const resetArchitecture = useArchitectureStore(
    (state) => state.resetArchitecture,
  );
  const resetDemo = useArchitectureStore((state) => state.resetDemo);
  const createArchitecture = useArchitectureStore(
    (state) => state.createArchitecture,
  );
  const loadArchitecture = useArchitectureStore(
    (state) => state.loadArchitecture,
  );
  const runAnalysis = useIntelligenceStore((state) => state.runAnalysis);
  const clearSimulation = useIntelligenceStore(
    (state) => state.clearSimulation,
  );
  const clearSelection = useWorkspaceUiStore((state) => state.clearSelection);
  const setActivePanel = useWorkspaceUiStore((state) => state.setActivePanel);
  const activityOpen = useWorkspaceUiStore((state) => state.activityOpen);
  const setActivityOpen = useWorkspaceUiStore((state) => state.setActivityOpen);
  const setNotice = useWorkspaceUiStore((state) => state.setNotice);
  const theme = useThemeStore((state) => state.theme);
  const toggleTheme = useThemeStore((state) => state.toggleTheme);
  const resetAgentSession = useWebMcpStore((state) => state.resetAgentSession);
  const setComparisonOpen = useWebMcpStore((state) => state.setComparisonOpen);

  const metadataTemplateId = architecture.metadata.templateId;
  const currentTemplate =
    typeof metadataTemplateId === 'string' &&
    architectureTemplateIds.includes(
      metadataTemplateId as ArchitectureTemplateId,
    )
      ? (metadataTemplateId as ArchitectureTemplateId)
      : 'custom';

  const loadTemplate = (value: string) => {
    if (value === 'custom') {
      return;
    }
    if (
      !runWorkspaceAction(() => {
        if (value === 'blank') {
          createArchitecture({
            name: 'Blank Architecture',
            description: 'A clean architecture workspace.',
            provider: architecture.provider,
            region: architecture.region,
          });
        } else {
          resetArchitecture(value as ArchitectureTemplateId);
        }
        resetAgentSession();
        clearSelection();
      }, 'The template could not be loaded. Your architecture remains available.')
    )
      return;
    if (
      runWorkspaceAction(
        () => runAnalysis(),
        'Template loaded, but analysis failed. Retry analysis.',
      )
    ) {
      setNotice({ kind: 'success', message: 'Architecture template loaded.' });
    }
  };

  const exportArchitecture = () => {
    const blob = new Blob([serializeArchitecture(architecture)], {
      type: 'application/json',
    });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = safeFilename(architecture.name);
    anchor.click();
    URL.revokeObjectURL(url);
    setNotice({
      kind: 'success',
      message: `${architecture.name} exported as validated JSON.`,
    });
  };

  const importArchitecture = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.currentTarget.files?.[0];
    event.currentTarget.value = '';
    if (!file) {
      return;
    }

    let imported;
    try {
      imported = deserializeArchitecture(await file.text());
    } catch (error) {
      setNotice({
        kind: 'error',
        message: `${describeImportError(error)} The current project was left unchanged.`,
      });
      return;
    }
    if (
      !runWorkspaceAction(() => {
        loadArchitecture(imported);
        resetAgentSession();
        clearSelection();
      }, 'Import could not complete. Your architecture remains available.')
    )
      return;
    if (
      runWorkspaceAction(
        () => runAnalysis(),
        'Architecture imported, but analysis failed. Retry analysis.',
      )
    ) {
      setNotice({
        kind: 'success',
        message: `${imported.name} imported successfully.`,
      });
    }
  };

  const resetCanonicalDemo = () => {
    if (
      !runWorkspaceAction(() => {
        resetDemo();
        resetAgentSession();
        clearSimulation();
        clearSelection();
        setActivePanel('inspector');
        setActivityOpen(false);
      }, 'The demo could not be reset. Your architecture remains available.')
    )
      return;
    if (
      runWorkspaceAction(
        () => runAnalysis(),
        'Demo restored, but analysis failed. Retry analysis.',
      )
    ) {
      setNotice({
        kind: 'success',
        message: 'Canonical Ecommerce demo restored and session state cleared.',
      });
    }
  };

  return (
    <header className="flex h-[56px] shrink-0 items-center gap-2 whitespace-nowrap border-b border-slate-800/90 bg-[#0b0f15] px-3">
      <div className="flex shrink-0 items-center">
        <div
          className="mr-2.5 grid size-7 place-items-center bg-cyan-400 text-slate-950"
          aria-hidden="true"
        >
          <Boxes className="size-4" strokeWidth={2.25} />
        </div>
        <div className="flex items-baseline gap-2 whitespace-nowrap">
          <span className="text-[13px] font-semibold tracking-[-0.01em] text-slate-100">
            AetherSketch
          </span>
          <span className="text-[11px] font-medium uppercase tracking-[0.12em] text-slate-600 max-[1600px]:hidden">
            Architecture Copilot
          </span>
        </div>
      </div>

      <div className="mx-1 h-5 w-px shrink-0 bg-slate-800" aria-hidden="true" />

      <div className="w-48 min-w-36 max-w-56">
        <label className="sr-only" htmlFor="architecture-template">
          Architecture template
        </label>
        <select
          id="architecture-template"
          className="h-8 max-w-full border border-slate-800 bg-[#0d121a] px-2 text-[12px] font-medium text-slate-300 outline-none focus:border-cyan-400/60"
          value={currentTemplate}
          onChange={(event) => loadTemplate(event.currentTarget.value)}
          title="Load an architecture template"
        >
          {currentTemplate === 'custom' ? (
            <option value="custom">{architecture.name}</option>
          ) : null}
          {architectureTemplateIds.map((templateId) => (
            <option key={templateId} value={templateId}>
              {templateLabels[templateId]}
            </option>
          ))}
          <option value="blank">Blank Architecture</option>
        </select>
      </div>

      <nav
        className="ml-auto flex shrink-0 items-center gap-0.5"
        aria-label="Workspace actions"
      >
        <div className="mr-1 flex items-center border-r border-slate-800 pr-1.5">
          <button
            type="button"
            className={iconButtonClass}
            aria-label="Undo"
            title={
              canUndo ? 'Undo last architecture change' : 'Nothing to undo'
            }
            onClick={() => {
              runWorkspaceAction(() => {
                undo();
                clearSelection();
              }, 'Undo could not complete.');
            }}
            disabled={!canUndo}
          >
            <Undo2 className="size-3.5" aria-hidden="true" />
          </button>
          <button
            type="button"
            className={iconButtonClass}
            aria-label="Redo"
            title={
              canRedo ? 'Redo last architecture change' : 'Nothing to redo'
            }
            onClick={() => {
              runWorkspaceAction(() => {
                redo();
                clearSelection();
              }, 'Redo could not complete.');
            }}
            disabled={!canRedo}
          >
            <Redo2 className="size-3.5" aria-hidden="true" />
          </button>
        </div>

        <button
          type="button"
          className="flex h-8 items-center gap-1.5 border border-cyan-400/25 bg-cyan-400/8 px-2.5 text-[11px] font-semibold text-cyan-200 transition-colors hover:bg-cyan-400/15 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400/80"
          aria-label="Reset Demo"
          title="Restore the canonical Ecommerce demo and clear history, simulation, edit mode, and comparison state"
          onClick={resetCanonicalDemo}
        >
          <RotateCcw className="size-3.5" aria-hidden="true" />
          <span>Reset Demo</span>
        </button>

        <DemoPrompts />

        <input
          ref={fileInputRef}
          type="file"
          accept="application/json,.json"
          className="sr-only"
          aria-label="Architecture JSON file"
          onChange={(event) => void importArchitecture(event)}
        />
        <button
          type="button"
          className="flex h-8 items-center gap-1.5 border border-transparent px-2 text-[12px] font-medium text-slate-500 transition-colors hover:border-slate-700 hover:bg-slate-800 hover:text-slate-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400/80"
          onClick={() => fileInputRef.current?.click()}
        >
          <Upload className="size-3.5" aria-hidden="true" />
          <span className="max-[1400px]:sr-only">Import</span>
        </button>
        <button
          type="button"
          className="flex h-8 items-center gap-1.5 border border-transparent px-2 text-[12px] font-medium text-slate-500 transition-colors hover:border-slate-700 hover:bg-slate-800 hover:text-slate-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400/80"
          onClick={() =>
            runWorkspaceAction(
              exportArchitecture,
              'Export could not complete. Your architecture remains available.',
            )
          }
        >
          <Download className="size-3.5" aria-hidden="true" />
          <span className="max-[1400px]:sr-only">Export</span>
        </button>
        <button
          type="button"
          className={`${iconButtonClass} relative`}
          aria-label="Activity history"
          title="Open activity history"
          aria-expanded={activityOpen}
          onClick={() => {
            setComparisonOpen(false);
            setActivityOpen(!activityOpen);
          }}
        >
          <History className="size-3.5" aria-hidden="true" />
          {activityCount > 0 ? (
            <span className="absolute right-0.5 top-0.5 min-w-3 bg-cyan-400 px-0.5 text-center text-[10px] font-bold leading-3 text-slate-950">
              {Math.min(activityCount, 99)}
            </span>
          ) : null}
        </button>

        <button
          type="button"
          className="ml-1 flex h-8 items-center gap-1.5 border border-slate-800 bg-[#0d121a] px-2 text-[11px] font-medium text-slate-500 transition-colors hover:border-slate-700 hover:bg-slate-800 hover:text-slate-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400/80"
          onClick={toggleTheme}
          aria-label={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}
          title={`Current theme: ${theme}. Switch to ${theme === 'dark' ? 'light' : 'dark'} mode.`}
        >
          {theme === 'dark' ? (
            <Moon className="size-3.5" aria-hidden="true" />
          ) : (
            <Sun className="size-3.5" aria-hidden="true" />
          )}
          <span className="max-[1260px]:sr-only">
            {theme === 'dark' ? 'Dark' : 'Light'}
          </span>
        </button>

        <div className="ml-1.5">
          <WebMcpStatus />
        </div>
      </nav>
    </header>
  );
}
