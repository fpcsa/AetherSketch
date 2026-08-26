import {
  Boxes,
  ChevronRight,
  CloudCog,
  Database,
  Network,
  RadioTower,
  ServerCog,
} from 'lucide-react';

import { componentCatalog, componentKinds } from '../../architecture/catalog';
import { useWorkspaceUiStore } from '../../stores/workspace-ui-store';
import {
  paletteCategories,
  type PaletteCategoryId,
} from './palette-categories';

const categoryIcons = {
  network: Network,
  compute: ServerCog,
  data: Database,
  integration: RadioTower,
  platform: CloudCog,
} satisfies Record<PaletteCategoryId, typeof Network>;

export function ComponentPalette() {
  const activeCategory = useWorkspaceUiStore(
    (state) => state.activePaletteCategory,
  );
  const setActiveCategory = useWorkspaceUiStore(
    (state) => state.setActivePaletteCategory,
  );
  const selectedCategory =
    paletteCategories.find((category) => category.id === activeCategory) ??
    paletteCategories[0];
  const catalogEntries = componentKinds
    .map((kind) => componentCatalog[kind])
    .filter((entry) => entry.category === activeCategory);

  return (
    <aside
      className="flex min-h-0 flex-col border-r border-slate-800/90 bg-[#0b0f15]"
      aria-labelledby="component-palette-title"
    >
      <div className="flex h-11 shrink-0 items-center justify-between border-b border-slate-800/80 px-3">
        <div>
          <h2
            id="component-palette-title"
            className="text-[11px] font-semibold uppercase tracking-[0.11em] text-slate-400"
          >
            Components
          </h2>
        </div>
        <Boxes className="size-3.5 text-slate-600" aria-hidden="true" />
      </div>

      <nav className="shrink-0 p-2" aria-label="Component categories">
        <ul className="space-y-0.5">
          {paletteCategories.map((category) => {
            const Icon = categoryIcons[category.id];
            const isActive = category.id === activeCategory;

            return (
              <li key={category.id}>
                <button
                  type="button"
                  onClick={() => setActiveCategory(category.id)}
                  className={`group flex h-9 w-full items-center gap-2.5 border-l-2 px-2 text-left text-[11px] font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-cyan-400/80 ${
                    isActive
                      ? 'border-cyan-400 bg-cyan-400/8 text-slate-100'
                      : 'border-transparent text-slate-500 hover:bg-slate-800/50 hover:text-slate-300'
                  }`}
                  aria-current={isActive ? 'page' : undefined}
                >
                  <Icon
                    className={`size-3.5 ${isActive ? 'text-cyan-400' : 'text-slate-600 group-hover:text-slate-400'}`}
                    aria-hidden="true"
                  />
                  <span>{category.label}</span>
                  <ChevronRight
                    className={`ml-auto size-3 ${isActive ? 'text-cyan-400/70' : 'text-slate-700'}`}
                    aria-hidden="true"
                  />
                </button>
              </li>
            );
          })}
        </ul>
      </nav>

      <div className="mx-3 border-t border-slate-800/80 pt-4">
        <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-500">
          {selectedCategory.label}
        </p>
        <p className="mt-1.5 text-[11px] leading-4 text-slate-600">
          {selectedCategory.description}
        </p>
      </div>

      <div className="mx-3 mt-3 min-h-0 flex-1 overflow-auto border-t border-slate-800/80 py-2">
        <p className="mb-1.5 text-[9px] uppercase tracking-[0.12em] text-slate-700">
          AWS-first catalog
        </p>
        <ul
          className="space-y-px"
          aria-label={`${selectedCategory.label} catalog`}
        >
          {catalogEntries.map((entry) => (
            <li
              key={entry.kind}
              className="flex min-h-10 items-center gap-2 border border-transparent px-2 py-1.5"
            >
              <span
                className="size-1.5 shrink-0 rounded-full bg-slate-700"
                aria-hidden="true"
              />
              <span className="min-w-0">
                <span className="block truncate text-[10px] font-medium text-slate-400">
                  {entry.displayName}
                </span>
                <span className="block truncate text-[9px] text-slate-700">
                  {entry.aws.displayName}
                </span>
              </span>
            </li>
          ))}
        </ul>
      </div>

      <div className="mt-auto border-t border-slate-800/80 px-3 py-2.5 text-[9px] uppercase tracking-[0.12em] text-slate-700">
        Provider-neutral IR · {componentKinds.length} kinds
      </div>
    </aside>
  );
}
