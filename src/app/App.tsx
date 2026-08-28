import { ArchitectureCanvas } from '../components/canvas/ArchitectureCanvas';
import { AgentSessionComparison } from '../components/agent/AgentSessionComparison';
import { CanvasErrorBoundary } from '../components/canvas/CanvasErrorBoundary';
import { InspectorSidebar } from '../components/inspector/InspectorSidebar';
import { ActivityDrawer } from '../components/layout/ActivityDrawer';
import { PersistenceRecoveryNotice } from '../components/layout/PersistenceRecoveryNotice';
import { StatusBar } from '../components/layout/StatusBar';
import { TopBar } from '../components/layout/TopBar';
import { WorkspaceNotice } from '../components/layout/WorkspaceNotice';
import { ComponentPalette } from '../components/palette/ComponentPalette';
import { useThemeStore } from '../stores/theme-store';
import { WebMcpRuntime } from '../webmcp';

export function App() {
  const theme = useThemeStore((state) => state.theme);

  return (
    <div
      className="relative flex h-dvh min-h-[640px] min-w-[1000px] flex-col overflow-hidden bg-[#080b10] text-slate-200"
      data-theme={theme}
    >
      <WebMcpRuntime />
      <PersistenceRecoveryNotice />
      <a
        href="#architecture-canvas"
        className="sr-only z-50 rounded bg-cyan-400 px-3 py-2 font-semibold text-slate-950 focus:not-sr-only focus:absolute focus:left-3 focus:top-3"
      >
        Skip to architecture canvas
      </a>

      <TopBar />

      <div className="grid min-h-0 flex-1 grid-cols-[220px_minmax(0,1fr)_344px] overflow-hidden max-[1180px]:grid-cols-[204px_minmax(0,1fr)_320px]">
        <ComponentPalette />
        <main id="architecture-canvas" className="min-w-0 bg-[#090d13]">
          <CanvasErrorBoundary>
            <ArchitectureCanvas />
          </CanvasErrorBoundary>
        </main>
        <InspectorSidebar />
      </div>

      <StatusBar />
      <ActivityDrawer />
      <AgentSessionComparison />
      <WorkspaceNotice />
    </div>
  );
}
