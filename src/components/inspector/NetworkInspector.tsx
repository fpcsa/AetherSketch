import type {
  ArchitectureComponent,
  ComponentUpdate,
  NetworkRule,
} from '../../architecture/model';
import {
  componentSubnets,
  managedServiceKinds,
  subnetKinds,
} from '../../architecture/network/structure';
import { internetPaths } from '../../architecture/network/routing';
import { useArchitectureStore } from '../../stores/architecture-store';
import { useWorkspaceUiStore } from '../../stores/workspace-ui-store';

const field =
  'mt-1 min-h-8 w-full min-w-0 border border-slate-700 bg-[#0a0f16] px-2 text-[12px] text-slate-200 disabled:opacity-45';
const button =
  'min-h-8 border border-slate-700 px-2 text-[12px] text-cyan-300 hover:border-cyan-400 disabled:opacity-40';
const label = 'block text-[12px] text-slate-400';

type Props = {
  component: ArchitectureComponent;
  commit: (changes: ComponentUpdate) => void;
};

export function NetworkInspector({ component, commit }: Props) {
  const architecture = useArchitectureStore((state) => state.architecture);
  const mode = useWorkspaceUiStore((state) => state.catalogDescriptionMode);
  const placement = component.network ?? {};
  const networks = architecture.components.filter(
    (item) => item.kind === 'virtual-network',
  );
  const subnets = architecture.components
    .filter((item) => item.kind === 'subnet')
    .filter(
      (item) =>
        placement.virtualNetworkId &&
        item.network?.virtualNetworkId === placement.virtualNetworkId,
    );
  const groups = architecture.components.filter(
    (item) =>
      item.kind === 'security-group' &&
      placement.virtualNetworkId &&
      item.network?.virtualNetworkId === placement.virtualNetworkId,
  );
  const placeable =
    subnetKinds.has(component.kind) ||
    [
      'subnet',
      'internet-gateway',
      'virtual-private-gateway',
      'security-group',
    ].includes(component.kind);
  const configurableReferences =
    component.kind === 'private-endpoint'
      ? [
          {
            key: 'serviceId',
            title: 'Target managed service',
            kinds: managedServiceKinds,
          },
        ]
      : component.kind === 'vpn-connection'
        ? [
            {
              key: 'gatewayId',
              title: 'Private gateway',
              kinds: new Set(['virtual-private-gateway']),
            },
            {
              key: 'externalNetworkId',
              title: 'External network',
              kinds: new Set(['external-network']),
            },
          ]
        : [];
  const setConfiguration = (key: string, value: string | NetworkRule[]) =>
    commit({ configuration: { [key]: value } });
  const selectedSubnets = componentSubnets(architecture, component);
  return (
    <div
      className="space-y-3 border-t border-slate-800/70 pt-3"
      aria-label="Network configuration"
    >
      <p className="text-[11px] font-semibold uppercase tracking-[0.1em] text-slate-400">
        Network placement & routing
      </p>
      {placeable ? (
        <>
          <label className={label}>
            {mode === 'aws' ? 'VPC' : 'Virtual network'}
            <select
              className={field}
              value={placement.virtualNetworkId ?? ''}
              onChange={(event) =>
                commit({
                  network: {
                    ...placement,
                    virtualNetworkId: event.currentTarget.value || undefined,
                    subnetIds: [],
                    securityGroupIds: [],
                  },
                })
              }
            >
              <option value="">Not assigned</option>
              {networks.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.name}
                </option>
              ))}
            </select>
          </label>
          {subnetKinds.has(component.kind) ? (
            <fieldset className="space-y-1.5 border border-slate-800 p-2">
              <legend className="px-1 text-[12px] text-slate-400">
                Subnets{' '}
                {component.kind === 'nat-gateway'
                  ? '(one zone)'
                  : '(one or more)'}
              </legend>
              {subnets.length === 0 ? (
                <p className="text-[12px] leading-5 text-slate-500">
                  Create subnets and assign them to this network first.
                </p>
              ) : (
                subnets.map((subnet) => (
                  <label
                    key={subnet.id}
                    className="flex min-h-8 items-center gap-2 text-[12px] text-slate-300"
                  >
                    <input
                      type="checkbox"
                      className="shrink-0 accent-cyan-400"
                      checked={
                        placement.subnetIds?.includes(subnet.id) ?? false
                      }
                      onChange={(event) =>
                        commit({
                          network: {
                            ...placement,
                            subnetIds: event.currentTarget.checked
                              ? component.kind === 'nat-gateway'
                                ? [subnet.id]
                                : [...(placement.subnetIds ?? []), subnet.id]
                              : (placement.subnetIds ?? []).filter(
                                  (id) => id !== subnet.id,
                                ),
                          },
                        })
                      }
                    />
                    <span className="min-w-0 break-words">
                      {subnet.name}
                      <span className="block text-[11px] text-slate-500">
                        {subnet.configuration.visibility} ·{' '}
                        {subnet.availabilityZones.join(', ')}
                      </span>
                    </span>
                  </label>
                ))
              )}
            </fieldset>
          ) : null}
          {subnetKinds.has(component.kind) &&
          component.kind !== 'nat-gateway' ? (
            <>
              <fieldset className="space-y-1 border border-slate-800 p-2">
                <legend className="px-1 text-[12px] text-slate-400">
                  {mode === 'aws'
                    ? 'Security groups'
                    : 'Attached network security rules'}
                </legend>
                {groups.length === 0 ? (
                  <p className="text-[12px] leading-5 text-slate-500">
                    No rules in this network. Add a rules component and attach
                    it here.
                  </p>
                ) : (
                  groups.map((group) => (
                    <label
                      key={group.id}
                      className="flex min-h-8 items-center gap-2 text-[12px] text-slate-300"
                    >
                      <input
                        type="checkbox"
                        className="accent-cyan-400"
                        checked={
                          placement.securityGroupIds?.includes(group.id) ??
                          false
                        }
                        onChange={(event) =>
                          commit({
                            network: {
                              ...placement,
                              securityGroupIds: event.currentTarget.checked
                                ? [
                                    ...(placement.securityGroupIds ?? []),
                                    group.id,
                                  ]
                                : (placement.securityGroupIds ?? []).filter(
                                    (id) => id !== group.id,
                                  ),
                            },
                          })
                        }
                      />
                      {group.name}
                    </label>
                  ))
                )}
              </fieldset>
              <label className="flex min-h-8 items-center gap-2 text-[12px] text-slate-300">
                <input
                  type="checkbox"
                  className="accent-cyan-400"
                  checked={placement.publicAddress ?? false}
                  onChange={(event) =>
                    commit({
                      network: {
                        ...placement,
                        publicAddress: event.currentTarget.checked,
                      },
                    })
                  }
                />
                Public address
              </label>
              <label className="flex min-h-8 items-center gap-2 text-[12px] text-slate-300">
                <input
                  type="checkbox"
                  className="accent-cyan-400"
                  checked={placement.internetAccessRequired ?? false}
                  onChange={(event) =>
                    commit({
                      network: {
                        ...placement,
                        internetAccessRequired: event.currentTarget.checked,
                      },
                    })
                  }
                />
                Requires HTTPS internet egress
              </label>
              {placement.internetAccessRequired ? (
                <div
                  className="border border-slate-700 p-2 text-[12px] leading-5"
                  aria-label="Internet reachability"
                >
                  {internetPaths(architecture, component).map(
                    (route, index) => (
                      <p
                        key={route.subnetId ?? index}
                        className={
                          route.reachable
                            ? 'text-emerald-300'
                            : 'text-amber-300'
                        }
                      >
                        {selectedSubnets.find(
                          (item) => item.id === route.subnetId,
                        )?.name ?? component.name}
                        :{' '}
                        {route.reachable
                          ? 'Internet reachable.'
                          : 'Internet unreachable.'}{' '}
                        {route.reason}
                      </p>
                    ),
                  )}
                </div>
              ) : null}
            </>
          ) : null}
        </>
      ) : null}
      {component.kind === 'subnet' ? (
        <div className="space-y-2">
          <p className="text-[12px] leading-5 text-slate-500">
            Local traffic stays within the network. Explicit routes below
            control internet and external network access.
          </p>
          {component.configuration.routes.map((route, index) => (
            <div
              key={`${index}:${route.destination}`}
              className="space-y-2 border border-slate-700 p-2"
            >
              <label className={label}>
                Route {index + 1} destination
                <select
                  className={field}
                  value={route.destination}
                  onChange={(event) => {
                    const destination = event.currentTarget
                      .value as typeof route.destination;
                    const target = architecture.components.find((item) =>
                      destination === 'internet'
                        ? (item.kind === 'nat-gateway' ||
                            item.kind === 'internet-gateway') &&
                          item.network?.virtualNetworkId ===
                            placement.virtualNetworkId
                        : item.kind === 'vpn-connection' &&
                          architecture.components.find(
                            (gateway) =>
                              gateway.id === item.configuration.gatewayId,
                          )?.network?.virtualNetworkId ===
                            placement.virtualNetworkId,
                    );
                    if (target)
                      commit({
                        configuration: {
                          routes: component.configuration.routes.map(
                            (item, i) =>
                              i === index
                                ? { destination, targetId: target.id }
                                : item,
                          ),
                        },
                      });
                  }}
                >
                  <option value="internet">Internet</option>
                  <option value="external-network">
                    External network (VPN)
                  </option>
                </select>
              </label>
              <label className={label}>
                Route {index + 1} gateway
                <select
                  className={field}
                  value={route.targetId}
                  onChange={(event) =>
                    commit({
                      configuration: {
                        routes: component.configuration.routes.map((item, i) =>
                          i === index
                            ? { ...item, targetId: event.currentTarget.value }
                            : item,
                        ),
                      },
                    })
                  }
                >
                  {architecture.components
                    .filter((item) =>
                      route.destination === 'internet'
                        ? (item.kind === 'nat-gateway' ||
                            item.kind === 'internet-gateway') &&
                          item.network?.virtualNetworkId ===
                            placement.virtualNetworkId
                        : item.kind === 'vpn-connection' &&
                          architecture.components.find(
                            (gateway) =>
                              gateway.id === item.configuration.gatewayId,
                          )?.network?.virtualNetworkId ===
                            placement.virtualNetworkId,
                    )
                    .map((item) => (
                      <option key={item.id} value={item.id}>
                        {item.name}
                      </option>
                    ))}
                </select>
              </label>
              <button
                type="button"
                className={button}
                onClick={() =>
                  commit({
                    configuration: {
                      routes: component.configuration.routes.filter(
                        (_, i) => i !== index,
                      ),
                    },
                  })
                }
              >
                Remove route {index + 1}
              </button>
            </div>
          ))}
          {(['internet', 'external-network'] as const).map((destination) => {
            const candidates = architecture.components.filter((item) =>
              destination === 'internet'
                ? (item.kind === 'nat-gateway' ||
                    item.kind === 'internet-gateway') &&
                  item.network?.virtualNetworkId === placement.virtualNetworkId
                : item.kind === 'vpn-connection' &&
                  architecture.components.find(
                    (gateway) => gateway.id === item.configuration.gatewayId,
                  )?.network?.virtualNetworkId === placement.virtualNetworkId,
            );
            const target = candidates.find(
              (item) =>
                !component.configuration.routes.some(
                  (route) => route.targetId === item.id,
                ),
            );
            const disabled =
              !target ||
              (destination === 'internet' &&
                component.configuration.routes.some(
                  (route) => route.destination === 'internet',
                ));
            return (
              <button
                key={destination}
                type="button"
                className={`${button} mr-2`}
                disabled={disabled}
                onClick={() =>
                  target &&
                  commit({
                    configuration: {
                      routes: [
                        ...component.configuration.routes,
                        { destination, targetId: target.id },
                      ],
                    },
                  })
                }
              >
                Add {destination === 'internet' ? 'internet' : 'VPN'} route
              </button>
            );
          })}
          <p className="text-[11px] leading-4 text-slate-500">
            Add and attach a gateway before creating a route.
          </p>
        </div>
      ) : null}
      {configurableReferences.map(({ key, title, kinds }) => (
        <label key={key} className={label}>
          {title}
          <select
            className={field}
            value={String(
              component.configuration[
                key as keyof typeof component.configuration
              ] ?? '',
            )}
            onChange={(event) =>
              setConfiguration(key, event.currentTarget.value)
            }
          >
            <option value="">Not configured</option>
            {architecture.components
              .filter((item) => kinds.has(item.kind))
              .map((item) => (
                <option key={item.id} value={item.id}>
                  {item.name}
                </option>
              ))}
          </select>
        </label>
      ))}
      {component.kind === 'security-group' ? (
        <>
          <p className="text-[12px] leading-5 text-slate-500">
            Allow rules apply to initiated connections. Responses are stateful.
            Empty lists deny that direction. Protocols match connection labels,
            such as HTTPS; * allows all.
          </p>
          {(['ingress', 'egress'] as const).map((direction) => (
            <div key={direction} className="space-y-2">
              <h4 className="text-[12px] font-semibold capitalize text-slate-300">
                {direction}
              </h4>
              {component.configuration[direction].map((rule, index) => (
                <div
                  key={index}
                  className="space-y-2 border border-slate-700 p-2"
                >
                  <label className={label}>
                    {direction} {index + 1} peer
                    <select
                      className={field}
                      value={rule.peerId}
                      onChange={(event) =>
                        setConfiguration(
                          direction,
                          component.configuration[direction].map((item, i) =>
                            i === index
                              ? { ...item, peerId: event.currentTarget.value }
                              : item,
                          ),
                        )
                      }
                    >
                      <option value="*">Any peer</option>
                      <option value="internet">Public internet</option>
                      {architecture.components.map((item) => (
                        <option key={item.id} value={item.id}>
                          {item.name}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className={label}>
                    {direction} {index + 1} protocol
                    <input
                      key={rule.protocol}
                      className={field}
                      defaultValue={rule.protocol}
                      onBlur={(event) => {
                        const protocol = event.currentTarget.value.trim();
                        if (protocol && protocol !== rule.protocol)
                          setConfiguration(
                            direction,
                            component.configuration[direction].map((item, i) =>
                              i === index ? { ...item, protocol } : item,
                            ),
                          );
                      }}
                    />
                  </label>
                  <button
                    type="button"
                    className={button}
                    onClick={() =>
                      setConfiguration(
                        direction,
                        component.configuration[direction].filter(
                          (_, i) => i !== index,
                        ),
                      )
                    }
                  >
                    Remove {direction} rule {index + 1}
                  </button>
                </div>
              ))}
              <button
                type="button"
                className={button}
                onClick={() =>
                  setConfiguration(direction, [
                    ...component.configuration[direction],
                    { peerId: '*', protocol: 'HTTPS' },
                  ])
                }
              >
                Add {direction} rule
              </button>
            </div>
          ))}
        </>
      ) : null}
      {!placeable && !configurableReferences.length ? (
        <p className="text-[12px] leading-5 text-slate-500">
          {component.kind === 'virtual-network'
            ? 'Assign subnets and gateways to this network from their inspectors. Boundaries resize to enclose their members.'
            : 'Connect this network to a VPN, then configure subnet return routes.'}
        </p>
      ) : null}
    </div>
  );
}
