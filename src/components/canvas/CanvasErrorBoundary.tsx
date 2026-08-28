import { RefreshCw, TriangleAlert } from 'lucide-react';
import { Component, Fragment, type ReactNode } from 'react';

type CanvasErrorBoundaryProps = {
  children: ReactNode;
};

type CanvasErrorBoundaryState = {
  error: Error | null;
  retryKey: number;
};

export class CanvasErrorBoundary extends Component<
  CanvasErrorBoundaryProps,
  CanvasErrorBoundaryState
> {
  state: CanvasErrorBoundaryState = { error: null, retryKey: 0 };

  static getDerivedStateFromError(error: Error): CanvasErrorBoundaryState {
    return { error, retryKey: 0 };
  }

  private retry = () => {
    this.setState((state) => ({
      error: null,
      retryKey: state.retryKey + 1,
    }));
  };

  render() {
    if (this.state.error) {
      return (
        <section
          className="grid h-full place-items-center bg-[#090d13] p-8 text-center"
          role="alert"
          aria-labelledby="canvas-recovery-title"
        >
          <div className="max-w-sm border border-rose-400/35 bg-rose-400/8 p-6">
            <TriangleAlert
              className="mx-auto size-5 text-rose-300"
              aria-hidden="true"
            />
            <h2
              id="canvas-recovery-title"
              className="mt-3 text-xs font-semibold text-slate-200"
            >
              Canvas rendering paused
            </h2>
            <p className="mt-2 text-[12px] leading-4 text-slate-500">
              Your architecture is still saved. Restart the visual canvas
              without reloading the project.
            </p>
            <button
              type="button"
              onClick={this.retry}
              className="mx-auto mt-4 flex h-8 items-center gap-1.5 border border-rose-400/40 px-3 text-[12px] font-semibold text-rose-300 transition-colors hover:bg-rose-400/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-400/70"
            >
              <RefreshCw className="size-3" aria-hidden="true" />
              Restart canvas
            </button>
          </div>
        </section>
      );
    }

    return <Fragment key={this.state.retryKey}>{this.props.children}</Fragment>;
  }
}
