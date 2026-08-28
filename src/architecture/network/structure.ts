import type {
  Architecture,
  ArchitectureComponent,
  ComponentKind,
} from '../model/types';

export const boundaryKinds = new Set<ComponentKind>([
  'virtual-network',
  'subnet',
]);
export const attachmentOnlyKinds = new Set<ComponentKind>([
  'virtual-network',
  'subnet',
  'security-group',
]);
export const managedServiceKinds = new Set<ComponentKind>([
  'object-storage',
  'nosql-database',
  'queue',
  'event-bus',
  'secrets-manager',
  'monitoring',
  'serverless-ai',
  'ai-agent',
  'identity',
]);
export const subnetKinds = new Set<ComponentKind>([
  'virtual-machine',
  'container-service',
  'serverless-function',
  'sql-database',
  'cache',
  'load-balancer',
  'api-gateway',
  'nat-gateway',
  'private-endpoint',
]);

function cidrRange(cidr: string): [number, number] | null {
  const match = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})\/(\d{1,2})$/.exec(
    cidr,
  );
  if (!match) return null;
  const octets = match.slice(1, 5).map(Number);
  const prefix = Number(match[5]);
  if (
    prefix > 32 ||
    octets.some(
      (value, index) => value > 255 || String(value) !== match[index + 1],
    )
  )
    return null;
  const start = octets.reduce((value, octet) => value * 256 + octet, 0);
  const size = 2 ** (32 - prefix);
  return start % size === 0 ? [start, start + size - 1] : null;
}

export function isIpv4Cidr(cidr: string): boolean {
  return cidrRange(cidr) !== null;
}

export function componentSubnets(
  architecture: Architecture,
  component: ArchitectureComponent,
) {
  return (component.network?.subnetIds ?? []).flatMap((id) => {
    const subnet = architecture.components.find((item) => item.id === id);
    return subnet?.kind === 'subnet' ? [subnet] : [];
  });
}

export function virtualNetworkId(
  architecture: Architecture,
  component: ArchitectureComponent,
): string | undefined {
  return component.kind === 'virtual-network'
    ? component.id
    : (component.network?.virtualNetworkId ??
        componentSubnets(architecture, component)[0]?.network
          ?.virtualNetworkId);
}

export function effectiveZones(
  architecture: Architecture,
  component: ArchitectureComponent,
): string[] {
  const subnets = componentSubnets(architecture, component);
  return subnets.length
    ? [...new Set(subnets.flatMap((subnet) => subnet.availabilityZones))]
    : component.availabilityZones;
}

export function withEffectiveZones(architecture: Architecture): Architecture {
  return {
    ...architecture,
    components: architecture.components.map((component) => ({
      ...component,
      availabilityZones: effectiveZones(architecture, component),
    })),
  };
}

export function referencedComponentIds(
  component: ArchitectureComponent,
): string[] {
  const ids = [
    component.network?.virtualNetworkId,
    ...(component.network?.subnetIds ?? []),
    ...(component.network?.securityGroupIds ?? []),
  ];
  if (component.kind === 'subnet')
    ids.push(...component.configuration.routes.map((route) => route.targetId));
  if (component.kind === 'private-endpoint')
    ids.push(component.configuration.serviceId);
  if (component.kind === 'vpn-connection')
    ids.push(
      component.configuration.gatewayId,
      component.configuration.externalNetworkId,
    );
  if (component.kind === 'security-group')
    ids.push(
      ...[...component.configuration.ingress, ...component.configuration.egress]
        .map((rule) => rule.peerId)
        .filter((id) => id !== '*' && id !== 'internet'),
    );
  return ids.filter((id): id is string => Boolean(id));
}

type ReferenceIssue = {
  index: number;
  path: (string | number)[];
  message: string;
};

/** Incomplete placement is editable; dangling, cyclic and mismatched references are not. */
export function networkReferenceIssues(
  architecture: Pick<Architecture, 'components' | 'connections'>,
): ReferenceIssue[] {
  const issues: ReferenceIssue[] = [];
  const byId = new Map(
    architecture.components.map((component) => [component.id, component]),
  );
  architecture.components.forEach((component, index) => {
    const issue = (message: string, path: (string | number)[] = ['network']) =>
      issues.push({ index, path, message: `${component.name}: ${message}` });
    const networkId = component.network?.virtualNetworkId;
    const network = networkId ? byId.get(networkId) : undefined;
    const subnets = (component.network?.subnetIds ?? []).map((id) =>
      byId.get(id),
    );
    if (networkId && network?.kind !== 'virtual-network')
      issue('Virtual network must reference an existing Virtual Network.');
    if (network && network.region !== component.region)
      issue('Network membership must stay within one region.');
    if (
      [
        'virtual-network',
        'internet',
        'external-network',
        'vpn-connection',
      ].includes(component.kind) &&
      (networkId || subnets.length)
    )
      issue('This kind cannot be placed inside a network.');
    if (subnets.length && !subnetKinds.has(component.kind))
      issue('This kind cannot be placed in subnets.');
    if (component.kind === 'nat-gateway' && subnets.length > 1)
      issue('A modeled NAT gateway is zonal; assign exactly one subnet.');
    if (component.kind === 'subnet' && component.availabilityZones.length !== 1)
      issue('A subnet belongs to exactly one availability zone.', [
        'availabilityZones',
      ]);
    for (const subnet of subnets) {
      if (subnet?.kind !== 'subnet') {
        issue('Subnet references must point to existing subnets.');
        continue;
      }
      if (!networkId || subnet.network?.virtualNetworkId !== networkId)
        issue(
          'All assigned subnets must belong to the selected virtual network.',
        );
    }
    for (const id of component.network?.securityGroupIds ?? []) {
      const group = byId.get(id);
      if (group?.kind !== 'security-group')
        issue(
          'Security rules must reference an existing Network Security Rules component.',
        );
      else if (!networkId || group.network?.virtualNetworkId !== networkId)
        issue(
          'Attached security rules must belong to the same virtual network.',
        );
      if (!subnetKinds.has(component.kind) || component.kind === 'nat-gateway')
        issue(
          'Security rules attach to workloads and private endpoints, not boundaries or gateways.',
        );
    }
    if (component.kind === 'subnet') {
      const range = cidrRange(component.configuration.cidr);
      if (network?.kind === 'virtual-network' && range) {
        const parent = cidrRange(network.configuration.cidr);
        if (parent && (range[0] < parent[0] || range[1] > parent[1]))
          issue('Subnet CIDR must be inside its virtual network CIDR.', [
            'configuration',
            'cidr',
          ]);
        for (const sibling of architecture.components) {
          if (
            sibling.kind !== 'subnet' ||
            sibling.id === component.id ||
            sibling.network?.virtualNetworkId !== networkId
          )
            continue;
          const other = cidrRange(sibling.configuration.cidr);
          if (other && range[0] <= other[1] && other[0] <= range[1])
            issue(`Subnet CIDR overlaps ${sibling.name}.`, [
              'configuration',
              'cidr',
            ]);
        }
      }
      const destinations = new Set<string>();
      component.configuration.routes.forEach((route, routeIndex) => {
        const target = byId.get(route.targetId);
        const path = ['configuration', 'routes', routeIndex];
        if (route.destination === 'internet') {
          if (
            target?.kind !== 'nat-gateway' &&
            target?.kind !== 'internet-gateway'
          )
            issue('Internet routes require a NAT or Internet Gateway.', path);
          else if (!networkId || target.network?.virtualNetworkId !== networkId)
            issue(
              'Route target must belong to the same virtual network.',
              path,
            );
        } else {
          if (target?.kind !== 'vpn-connection')
            issue('External routes require a VPN Connection.', path);
          else if (
            !networkId ||
            byId.get(target.configuration.gatewayId)?.network
              ?.virtualNetworkId !== networkId
          )
            issue(
              'VPN gateway must belong to the subnet virtual network.',
              path,
            );
        }
        const destination =
          route.destination === 'internet'
            ? 'internet'
            : target?.kind === 'vpn-connection'
              ? target.configuration.externalNetworkId
              : route.targetId;
        if (destinations.has(destination))
          issue(
            'Only one route per destination is supported; use a separate subnet for another zone.',
            path,
          );
        destinations.add(destination);
      });
    }
    if (
      component.kind === 'private-endpoint' &&
      component.configuration.serviceId &&
      !managedServiceKinds.has(
        byId.get(component.configuration.serviceId)?.kind as ComponentKind,
      )
    )
      issue('Private endpoint must reference a supported managed service.', [
        'configuration',
        'serviceId',
      ]);
    if (
      component.kind === 'private-endpoint' &&
      component.configuration.serviceId
    ) {
      const service = byId.get(component.configuration.serviceId);
      if (service && service.region !== component.region)
        issue('Private endpoints target managed services in the same region.', [
          'configuration',
          'serviceId',
        ]);
    }
    if (component.kind === 'vpn-connection') {
      if (
        component.configuration.gatewayId &&
        byId.get(component.configuration.gatewayId)?.kind !==
          'virtual-private-gateway'
      )
        issue('VPN gateway must reference a Virtual Private Gateway.', [
          'configuration',
          'gatewayId',
        ]);
      if (
        component.configuration.externalNetworkId &&
        byId.get(component.configuration.externalNetworkId)?.kind !==
          'external-network'
      )
        issue('VPN peer must reference an External Network.', [
          'configuration',
          'externalNetworkId',
        ]);
    }
    if (component.kind === 'security-group') {
      for (const direction of ['ingress', 'egress'] as const) {
        component.configuration[direction].forEach((rule, ruleIndex) => {
          if (
            !['*', 'internet'].includes(rule.peerId) &&
            !byId.has(rule.peerId)
          )
            issue(
              'Rule peer must reference an existing component, * or internet.',
              ['configuration', direction, ruleIndex],
            );
        });
      }
    }
    if (
      attachmentOnlyKinds.has(component.kind) &&
      architecture.connections.some(
        (edge) => edge.source === component.id || edge.target === component.id,
      )
    )
      issue(
        'Boundaries and security rules use membership and attachments, not traffic connections.',
      );
  });
  return issues;
}
