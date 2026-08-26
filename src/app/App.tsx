import { CanvasPlaceholder } from '../components/canvas/CanvasPlaceholder';
import { InspectorSidebar } from '../components/inspector/InspectorSidebar';
import { StatusBar } from '../components/layout/StatusBar';
import { TopBar } from '../components/layout/TopBar';
import { ComponentPalette } from '../components/palette/ComponentPalette';

export function App() {
  return (
    <div className="flex h-dvh min-h-[640px] min-w-[1024px] flex-col overflow-hidden bg-[#080b10] text-slate-200">
      <a
        href="#architecture-canvas"
        className="sr-only z-50 rounded bg-cyan-400 px-3 py-2 font-semibold text-slate-950 focus:not-sr-only focus:absolute focus:left-3 focus:top-3"
      >
        Skip to architecture canvas
      </a>

      <TopBar />

      <div className="grid min-h-0 flex-1 grid-cols-[236px_minmax(0,1fr)_308px] overflow-hidden max-[1180px]:grid-cols-[216px_minmax(0,1fr)_284px]">
        <ComponentPalette />
        <main id="architecture-canvas" className="min-w-0 bg-[#090d13]">
          <CanvasPlaceholder />
        </main>
        <InspectorSidebar />
      </div>

      <StatusBar />
    </div>
  );
}
