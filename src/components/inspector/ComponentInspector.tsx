import { LockKeyhole, Trash2, UnlockKeyhole } from 'lucide-react';

import { getCatalogEntry } from '../../architecture/catalog';
import type {
  ArchitectureComponent,
  ComponentKind,
  ComponentUpdate,
  JsonValue,
} from '../../architecture/model';
import { useArchitectureStore } from '../../stores/architecture-store';
import { useWorkspaceUiStore } from '../../stores/workspace-ui-store';

const configurationOptions: Partial<
  Record<ComponentKind, Record<string, readonly string[]>>
> = {
  internet: { entryType: ['public-internet'] },
  dns: {
    routingPolicy: ['simple', 'latency', 'failover'],
    zoneType: ['public', 'private'],
  },
  cdn: {
    cachePolicy: ['managed', 'custom'],
    priceClass: ['regional', 'all'],
  },
  'load-balancer': {
    scheme: ['internet-facing', 'internal'],
  },
  'api-gateway': {
    endpointType: ['regional', 'edge', 'private'],
  },
  'virtual-machine': {
    operatingSystem: ['linux', 'windows'],
  },
  'container-service': { launchType: ['fargate', 'ec2'] },
  worker: { runtime: ['edge'] },
  'serverless-ai': {
    modality: ['text', 'multimodal', 'embedding'],
  },
  'ai-agent': {
    orchestrationMode: ['single-agent', 'supervisor', 'collaborator'],
  },
  'sql-database': {
    engine: ['postgresql', 'mysql'],
    size: ['small', 'medium', 'large'],
  },
  'nosql-database': {
    capacityMode: ['on-demand', 'provisioned'],
  },
  cache: { engine: ['redis'] },
  queue: { queueType: ['standard', 'fifo'] },
  identity: { identityType: ['workforce', 'customer', 'service'] },
};

const inputClass =
  'mt-1 h-8 w-full border border-slate-700 bg-[#0a0f16] px-2 text-[10px] text-slate-200 outline-none transition-colors placeholder:text-slate-700 focus:border-cyan-400/70 disabled:cursor-not-allowed disabled:opacity-45';

function formatPropertyName(name: string): string {
  return name
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .replace(/AZ/g, 'AZ')
    .replace(/^./, (character) => character.toUpperCase());
}

type ComponentInspectorProps = {
  component: ArchitectureComponent;
};

export function ComponentInspector({ component }: ComponentInspectorProps) {
  const updateComponent = useArchitectureStore(
    (state) => state.updateComponent,
  );
  const removeComponent = useArchitectureStore(
    (state) => state.removeComponent,
  );
  const lockComponent = useArchitectureStore((state) => state.lockComponent);
  const unlockComponent = useArchitectureStore(
    (state) => state.unlockComponent,
  );
  const clearSelection = useWorkspaceUiStore((state) => state.clearSelection);
  const setNotice = useWorkspaceUiStore((state) => state.setNotice);
  const catalog = getCatalogEntry(component.kind);

  const commit = (changes: ComponentUpdate) => {
    try {
      updateComponent(component.id, changes);
    } catch (error) {
      setNotice({
        kind: 'error',
        message:
          error instanceof Error ? error.message : 'Component update failed.',
      });
    }
  };

  const commitConfiguration = (key: string, value: JsonValue) => {
    commit({
      configuration: { [key]: value },
    });
  };

  return (
    <div className="min-h-0 flex-1 overflow-auto">
      <div className="border-b border-slate-800/80 px-3 py-3">
        <div className="flex items-start gap-2">
          <div className="min-w-0 flex-1">
            <p className="truncate text-[11px] font-semibold text-slate-200">
              {component.name}
            </p>
            <p className="mt-0.5 truncate text-[9px] text-slate-600">
              {catalog.aws.displayName} · {component.kind}
            </p>
          </div>
          <span
            className={`border px-1.5 py-0.5 text-[8px] font-semibold uppercase tracking-[0.08em] ${
              component.locked
                ? 'border-amber-400/30 bg-amber-400/10 text-amber-300'
                : 'border-emerald-400/20 bg-emerald-400/5 text-emerald-400/80'
            }`}
          >
            {component.locked ? 'Locked' : 'Editable'}
          </span>
        </div>
      </div>

      <fieldset disabled={component.locked} className="space-y-3 px-3 py-3">
        <legend className="sr-only">Component properties</legend>

        <label className="block text-[9px] font-medium uppercase tracking-[0.1em] text-slate-600">
          Component name
          <input
            key={`${component.id}:name:${component.name}`}
            className={inputClass}
            defaultValue={component.name}
            onBlur={(event) => {
              const value = event.currentTarget.value.trim();
              if (value && value !== component.name) {
                commit({ name: value });
              }
            }}
          />
        </label>

        <label className="block text-[9px] font-medium uppercase tracking-[0.1em] text-slate-600">
          Region
          <input
            key={`${component.id}:region:${component.region}`}
            className={inputClass}
            defaultValue={component.region}
            onBlur={(event) => {
              const value = event.currentTarget.value.trim();
              if (value && value !== component.region) {
                commit({ region: value });
              }
            }}
          />
        </label>

        <label className="block text-[9px] font-medium uppercase tracking-[0.1em] text-slate-600">
          Availability zones
          <input
            key={`${component.id}:az:${component.availabilityZones.join(',')}`}
            className={inputClass}
            defaultValue={component.availabilityZones.join(', ')}
            placeholder="eu-west-1a, eu-west-1b"
            onBlur={(event) => {
              const zones = event.currentTarget.value
                .split(',')
                .map((zone) => zone.trim())
                .filter(Boolean);
              if (zones.join('|') !== component.availabilityZones.join('|')) {
                commit({ availabilityZones: zones });
              }
            }}
          />
        </label>

        {catalog.supportedProperties.includes('replicas') ? (
          <label className="block text-[9px] font-medium uppercase tracking-[0.1em] text-slate-600">
            Replicas
            <input
              key={`${component.id}:replicas:${component.replicas}`}
              className={inputClass}
              type="number"
              min={1}
              max={10_000}
              defaultValue={component.replicas}
              onBlur={(event) => {
                const value = Number(event.currentTarget.value);
                if (Number.isInteger(value) && value !== component.replicas) {
                  commit({ replicas: value });
                }
              }}
            />
          </label>
        ) : null}

        <div className="border-t border-slate-800/70 pt-3">
          <p className="mb-2 text-[9px] font-semibold uppercase tracking-[0.11em] text-slate-600">
            Service configuration
          </p>
          <div className="space-y-2.5">
            {Object.entries(component.configuration).map(([key, value]) => {
              const label = formatPropertyName(key);
              const options = configurationOptions[component.kind]?.[key];

              if (typeof value === 'boolean') {
                return (
                  <label
                    key={key}
                    className="flex min-h-8 items-center justify-between gap-3 border border-slate-800/70 bg-slate-900/20 px-2.5 text-[10px] text-slate-400"
                  >
                    <span>{label}</span>
                    <input
                      type="checkbox"
                      checked={value}
                      onChange={(event) =>
                        commitConfiguration(key, event.currentTarget.checked)
                      }
                      className="size-3.5 accent-cyan-400"
                    />
                  </label>
                );
              }

              if (options) {
                return (
                  <label
                    key={key}
                    className="block text-[9px] font-medium uppercase tracking-[0.1em] text-slate-600"
                  >
                    {label}
                    <select
                      className={inputClass}
                      value={String(value)}
                      onChange={(event) =>
                        commitConfiguration(key, event.currentTarget.value)
                      }
                    >
                      {options.map((option) => (
                        <option key={option} value={option}>
                          {option}
                        </option>
                      ))}
                    </select>
                  </label>
                );
              }

              return (
                <label
                  key={key}
                  className="block text-[9px] font-medium uppercase tracking-[0.1em] text-slate-600"
                >
                  {label}
                  <input
                    key={`${component.id}:${key}:${String(value)}`}
                    className={inputClass}
                    type={typeof value === 'number' ? 'number' : 'text'}
                    defaultValue={String(value)}
                    onBlur={(event) => {
                      const nextValue =
                        typeof value === 'number'
                          ? Number(event.currentTarget.value)
                          : event.currentTarget.value.trim();
                      if (
                        (typeof nextValue !== 'number' ||
                          Number.isFinite(nextValue)) &&
                        nextValue !== value
                      ) {
                        commitConfiguration(key, nextValue);
                      }
                    }}
                  />
                </label>
              );
            })}
          </div>
        </div>

        <label className="flex min-h-9 items-center justify-between gap-3 border border-slate-800/70 bg-slate-900/20 px-2.5 text-[10px] text-slate-400">
          <span>
            Critical component
            <span className="mt-0.5 block text-[8px] text-slate-700">
              Included in critical-path analysis
            </span>
          </span>
          <input
            type="checkbox"
            checked={component.critical}
            onChange={(event) =>
              commit({ critical: event.currentTarget.checked })
            }
            className="size-3.5 accent-rose-400"
          />
        </label>
      </fieldset>

      {component.locked ? (
        <p className="mx-3 border border-amber-400/20 bg-amber-400/5 p-2 text-[9px] leading-4 text-amber-200/70">
          Architectural properties are protected. Unlock this component to edit
          or delete it; canvas movement remains available.
        </p>
      ) : null}

      <div className="flex gap-2 border-t border-slate-800/80 p-3">
        <button
          type="button"
          onClick={() =>
            component.locked
              ? unlockComponent(component.id)
              : lockComponent(component.id)
          }
          className="flex h-8 flex-1 items-center justify-center gap-1.5 border border-slate-700 text-[10px] font-medium text-slate-300 transition-colors hover:border-cyan-400/40 hover:text-cyan-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400/80"
        >
          {component.locked ? (
            <UnlockKeyhole className="size-3" aria-hidden="true" />
          ) : (
            <LockKeyhole className="size-3" aria-hidden="true" />
          )}
          {component.locked ? 'Unlock component' : 'Lock component'}
        </button>
        <button
          type="button"
          disabled={component.locked}
          onClick={() => {
            removeComponent(component.id);
            clearSelection();
          }}
          className="grid size-8 place-items-center border border-slate-700 text-slate-500 transition-colors enabled:hover:border-rose-400/50 enabled:hover:text-rose-300 disabled:cursor-not-allowed disabled:opacity-35 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-400/70"
          aria-label={`Delete ${component.name}`}
          title={
            component.locked ? 'Unlock before deleting' : 'Delete component'
          }
        >
          <Trash2 className="size-3.5" aria-hidden="true" />
        </button>
      </div>
    </div>
  );
}
