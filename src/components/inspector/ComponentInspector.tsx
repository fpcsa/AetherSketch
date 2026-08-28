import { NetworkInspector } from './NetworkInspector';
import {
  effectiveZones,
  subnetKinds,
} from '../../architecture/network/structure';
import { Focus, LockKeyhole, Trash2, UnlockKeyhole } from 'lucide-react';

import { getCatalogEntry } from '../../architecture/catalog';
import type {
  ArchitectureComponent,
  ComponentKind,
  ComponentUpdate,
  JsonValue,
} from '../../architecture/model';
import { useArchitectureStore } from '../../stores/architecture-store';
import { useWorkspaceUiStore } from '../../stores/workspace-ui-store';
import { runWorkspaceAction } from '../layout/workspace-actions';

const configurationOptions: Partial<
  Record<ComponentKind, Record<string, readonly string[]>>
> = {
  internet: { entryType: ['public-internet'] },
  subnet: { visibility: ['public', 'private'] },
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
  'mt-1 h-8 w-full border border-slate-700 bg-[#0a0f16] px-2 text-[12px] text-slate-200 outline-none transition-colors placeholder:text-slate-700 focus:border-cyan-400/70 disabled:cursor-not-allowed disabled:opacity-45';

function formatPropertyName(name: string): string {
  if (name === 'asn') return 'Private ASN';
  if (name === 'cidr') return 'IPv4 CIDR';
  if (name === 'monthlyDataGb') return 'Monthly processed data (GB)';
  return name
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .replace(/^./, (character) => character.toUpperCase());
}

type ComponentInspectorProps = {
  component: ArchitectureComponent;
};

export function ComponentInspector({ component }: ComponentInspectorProps) {
  const architecture = useArchitectureStore((state) => state.architecture);
  const assignedSubnets = Boolean(component.network?.subnetIds?.length);
  const zones = effectiveZones(architecture, component);
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
  const catalogDescriptionMode = useWorkspaceUiStore(
    (state) => state.catalogDescriptionMode,
  );
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
            <p className="break-words text-[13px] font-semibold text-slate-200">
              {component.name}
            </p>
            <p className="mt-0.5 break-words text-[11px] leading-4 text-slate-600">
              {catalogDescriptionMode === 'aws'
                ? `${catalog.aws.displayName} · ${component.kind}`
                : component.kind}
            </p>
          </div>
          <span
            className={`border px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-[0.08em] ${
              component.locked
                ? 'border-amber-400/30 bg-amber-400/10 text-amber-300'
                : 'border-emerald-400/20 bg-emerald-400/5 text-emerald-400/80'
            }`}
          >
            {component.locked ? 'Locked' : 'Editable'}
          </span>
        </div>
      </div>

      <button
        type="button"
        onClick={() =>
          useWorkspaceUiStore.getState().focusComponent(component.id)
        }
        className="mx-3 mt-3 flex min-h-8 items-center justify-center gap-2 border border-slate-700 px-3 text-[12px] text-cyan-300"
      >
        <Focus className="size-3.5" aria-hidden="true" />
        Focus on canvas
      </button>

      <fieldset disabled={component.locked} className="space-y-3 px-3 py-3">
        <legend className="sr-only">Component properties</legend>

        <label className="block text-[11px] font-medium uppercase tracking-[0.1em] text-slate-600">
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

        <label className="block text-[11px] font-medium uppercase tracking-[0.1em] text-slate-600">
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

        <label className="block text-[11px] font-medium uppercase tracking-[0.1em] text-slate-600">
          Availability zones
          <input
            key={`${component.id}:az:${zones.join(',')}`}
            className={inputClass}
            defaultValue={zones.join(', ')}
            disabled={assignedSubnets}
            title={
              assignedSubnets
                ? 'Availability zones are derived from assigned subnets.'
                : undefined
            }
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
          <label className="block text-[11px] font-medium uppercase tracking-[0.1em] text-slate-600">
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

        {subnetKinds.has(component.kind) ||
        [
          'virtual-network',
          'subnet',
          'security-group',
          'internet-gateway',
          'virtual-private-gateway',
          'external-network',
          'vpn-connection',
        ].includes(component.kind) ? (
          <NetworkInspector component={component} commit={commit} />
        ) : null}

        <div className="border-t border-slate-800/70 pt-3">
          <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.11em] text-slate-600">
            Service configuration
          </p>
          <div className="space-y-2.5">
            {component.kind === 'internet-gateway' ? (
              <p className="text-[12px] leading-5 text-slate-500">
                Attach this gateway to a virtual network, then add an internet
                route to a public subnet. Traffic charges are excluded.
              </p>
            ) : null}
            {component.kind === 'virtual-private-gateway' ? (
              <p className="text-[12px] leading-5 text-slate-500">
                Private ASN: 64512–65534 or 4200000000–4294967294. VPN
                connections are modeled separately; dedicated links and transfer
                charges are excluded.
              </p>
            ) : null}
            {Object.entries(component.configuration).map(([key, value]) => {
              if (
                Array.isArray(value) ||
                ['serviceId', 'gatewayId', 'externalNetworkId'].includes(key)
              )
                return null;
              const label = formatPropertyName(key);
              const options = configurationOptions[component.kind]?.[key];

              if (typeof value === 'boolean') {
                return (
                  <label
                    key={key}
                    className="flex min-h-8 items-center justify-between gap-3 border border-slate-800/70 bg-slate-900/20 px-2.5 text-[12px] text-slate-400"
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
                    className="block text-[11px] font-medium uppercase tracking-[0.1em] text-slate-600"
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
                          {catalogDescriptionMode === 'generic' &&
                          component.kind === 'container-service' &&
                          key === 'launchType'
                            ? option === 'fargate'
                              ? 'Managed serverless'
                              : 'Virtual machines'
                            : option}
                        </option>
                      ))}
                    </select>
                  </label>
                );
              }

              return (
                <label
                  key={key}
                  className="block text-[11px] font-medium uppercase tracking-[0.1em] text-slate-600"
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

        <label className="flex min-h-9 items-center justify-between gap-3 border border-slate-800/70 bg-slate-900/20 px-2.5 text-[12px] text-slate-400">
          <span>
            Critical component
            <span className="mt-0.5 block text-[10px] text-slate-700">
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
        <p className="mx-3 border border-amber-400/20 bg-amber-400/5 p-2 text-[11px] leading-4 text-amber-200/70">
          Architectural properties are protected. Unlock this component to edit
          or delete it; canvas movement remains available.
        </p>
      ) : null}

      <div className="flex gap-2 border-t border-slate-800/80 p-3">
        <button
          type="button"
          onClick={() =>
            runWorkspaceAction(
              () =>
                component.locked
                  ? unlockComponent(component.id)
                  : lockComponent(component.id),
              'The component lock could not be changed.',
            )
          }
          className="flex h-8 flex-1 items-center justify-center gap-1.5 border border-slate-700 text-[12px] font-medium text-slate-300 transition-colors hover:border-cyan-400/40 hover:text-cyan-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400/80"
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
            runWorkspaceAction(() => {
              removeComponent(component.id);
              clearSelection();
            }, 'The component could not be deleted.');
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
