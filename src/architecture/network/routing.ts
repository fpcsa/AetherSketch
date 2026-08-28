import type {
  Architecture,
  ArchitectureComponent,
  ArchitectureConnection,
  ComponentOfKind,
} from '../model/types';
import {
  attachmentOnlyKinds,
  componentSubnets,
  managedServiceKinds,
  subnetKinds,
  virtualNetworkId,
} from './structure';

export type NetworkPath = {
  reachable: boolean;
  reason: string;
  dependencyIds: string[];
  natGatewayId?: string;
  subnetId?: string;
};

const path = (
  reachable: boolean,
  reason: string,
  dependencyIds: string[] = [],
): NetworkPath => ({ reachable, reason, dependencyIds });
const byId = (architecture: Architecture, id: string) =>
  architecture.components.find((component) => component.id === id);

function livePlacement(
  architecture: Architecture,
  component: ArchitectureComponent,
  failed: ReadonlySet<string>,
): boolean {
  if (failed.has(component.id)) return false;
  const networkId = virtualNetworkId(architecture, component);
  if (networkId && failed.has(networkId)) return false;
  const subnets = componentSubnets(architecture, component);
  if (networkId && subnetKinds.has(component.kind) && !subnets.length)
    return false;
  return !subnets.length || subnets.some((subnet) => !failed.has(subnet.id));
}

function matchesRulePeer(
  architecture: Architecture,
  peerId: string,
  peer: ArchitectureComponent | 'internet',
): boolean {
  if (peerId === '*') return true;
  if (peer === 'internet')
    return (
      peerId === 'internet' || byId(architecture, peerId)?.kind === 'internet'
    );
  if (peerId === 'internet')
    return peer.kind === 'internet' || peer.kind === 'internet-gateway';
  return (
    peerId === peer.id ||
    peerId === virtualNetworkId(architecture, peer) ||
    Boolean(peer.network?.securityGroupIds?.includes(peerId))
  );
}

export function policyAllows(
  architecture: Architecture,
  component: ArchitectureComponent,
  direction: 'ingress' | 'egress',
  peer: ArchitectureComponent | 'internet',
  protocol?: string,
): boolean {
  const ids = component.network?.securityGroupIds ?? [];
  if (!ids.length) return true; // Unmodeled policy is reported separately; legacy graphs remain usable.
  return ids.some((id) => {
    const group = byId(architecture, id);
    return (
      group?.kind === 'security-group' &&
      group.configuration[direction].some(
        (rule) =>
          matchesRulePeer(architecture, rule.peerId, peer) &&
          (rule.protocol === '*' ||
            (protocol !== undefined &&
              rule.protocol.toLowerCase() === protocol.toLowerCase())),
      )
    );
  });
}

function subnetInternetPath(
  architecture: Architecture,
  subnet: ComponentOfKind<'subnet'>,
  failed: ReadonlySet<string>,
  publicAddress: boolean,
): NetworkPath {
  const networkId = subnet.network?.virtualNetworkId;
  const dependencies = [subnet.id, ...(networkId ? [networkId] : [])];
  if (!networkId || !livePlacement(architecture, subnet, failed))
    return path(
      false,
      'The subnet or its virtual network is unavailable or unattached.',
      dependencies,
    );
  const route = subnet.configuration.routes.find(
    (item) => item.destination === 'internet',
  );
  if (!route)
    return path(false, 'The subnet has no internet route.', dependencies);
  const target = byId(architecture, route.targetId);
  dependencies.push(route.targetId);
  if (!target || !livePlacement(architecture, target, failed))
    return {
      ...path(false, 'The route gateway is unavailable.', dependencies),
      ...(target?.kind === 'nat-gateway' ? { natGatewayId: target.id } : {}),
    };
  if (target.network?.virtualNetworkId !== networkId)
    return path(
      false,
      'The gateway is outside this virtual network.',
      dependencies,
    );
  if (target.kind === 'internet-gateway')
    return path(
      subnet.configuration.visibility === 'public' && publicAddress,
      subnet.configuration.visibility !== 'public'
        ? 'A private subnet cannot use an Internet Gateway directly.'
        : !publicAddress
          ? 'Direct internet access requires a modeled public address.'
          : 'Public subnet route through the Internet Gateway.',
      dependencies,
    );
  if (target.kind !== 'nat-gateway')
    return path(false, 'Unsupported internet route target.', dependencies);
  const natSubnet = componentSubnets(architecture, target)[0];
  if (!natSubnet || natSubnet.configuration.visibility !== 'public')
    return {
      ...path(false, 'The NAT gateway needs a public subnet.', dependencies),
      natGatewayId: target.id,
    };
  const gatewayRoute = natSubnet.configuration.routes.find(
    (item) => item.destination === 'internet',
  );
  const gateway = gatewayRoute
    ? byId(architecture, gatewayRoute.targetId)
    : undefined;
  dependencies.push(natSubnet.id, ...(gateway ? [gateway.id] : []));
  const reachable =
    livePlacement(architecture, natSubnet, failed) &&
    gateway?.kind === 'internet-gateway' &&
    gateway.network?.virtualNetworkId === networkId &&
    !failed.has(gateway.id);
  return {
    ...path(
      Boolean(reachable),
      reachable
        ? 'Outbound internet through the NAT gateway and Internet Gateway.'
        : 'The NAT public subnet has no surviving Internet Gateway route.',
      dependencies,
    ),
    natGatewayId: target.id,
  };
}

export function internetPaths(
  architecture: Architecture,
  component: ArchitectureComponent,
  failed: ReadonlySet<string> = new Set(),
  protocol = 'HTTPS',
): NetworkPath[] {
  const subnets = componentSubnets(architecture, component);
  if (!subnets.length)
    return [
      path(false, 'Assign at least one subnet to model internet reachability.'),
    ];
  return subnets.map((subnet) => {
    const result = subnetInternetPath(
      architecture,
      subnet,
      failed,
      component.kind === 'nat-gateway' ||
        component.network?.publicAddress === true ||
        (component.kind === 'load-balancer' &&
          component.configuration.scheme === 'internet-facing'),
    );
    if (!policyAllows(architecture, component, 'egress', 'internet', protocol))
      return {
        ...result,
        subnetId: subnet.id,
        reachable: false,
        reason: `Attached security rules block ${protocol} internet egress.`,
      };
    return { ...result, subnetId: subnet.id };
  });
}

function vpnPaths(
  architecture: Architecture,
  component: ArchitectureComponent,
  external: ArchitectureComponent,
  failed: ReadonlySet<string>,
): NetworkPath[] {
  return componentSubnets(architecture, component).flatMap((subnet) =>
    subnet.configuration.routes
      .filter((route) => route.destination === 'external-network')
      .map((route) => {
        const vpn = byId(architecture, route.targetId);
        const gateway =
          vpn?.kind === 'vpn-connection'
            ? byId(architecture, vpn.configuration.gatewayId)
            : undefined;
        const dependencies = [
          subnet.id,
          route.targetId,
          external.id,
          ...(gateway ? [gateway.id] : []),
        ];
        const reachable =
          vpn?.kind === 'vpn-connection' &&
          vpn.configuration.externalNetworkId === external.id &&
          gateway?.kind === 'virtual-private-gateway' &&
          gateway.network?.virtualNetworkId ===
            virtualNetworkId(architecture, component) &&
          [subnet, vpn, gateway, external].every((item) =>
            livePlacement(architecture, item, failed),
          );
        return path(
          Boolean(reachable),
          reachable
            ? 'Private route through the VPN connection.'
            : 'No surviving VPN route to this external network.',
          dependencies,
        );
      }),
  );
}

function publicIngress(
  architecture: Architecture,
  target: ArchitectureComponent,
  failed: ReadonlySet<string>,
): NetworkPath {
  const publicAddress =
    target.network?.publicAddress === true ||
    (target.kind === 'load-balancer' &&
      target.configuration.scheme === 'internet-facing');
  const results = componentSubnets(architecture, target).map((subnet) => {
    const result = subnetInternetPath(
      architecture,
      subnet,
      failed,
      publicAddress,
    );
    return { ...result, reachable: result.reachable && !result.natGatewayId };
  });
  return (
    results.find((result) => result.reachable) ??
    path(
      false,
      'No public subnet, public address and Internet Gateway route. NAT does not permit unsolicited inbound traffic.',
    )
  );
}

export function hasModeledIngress(
  architecture: Architecture,
  component: ArchitectureComponent,
  failed: ReadonlySet<string> = new Set(),
): boolean {
  if (!component.network?.virtualNetworkId) return true;
  if (
    component.kind === 'api-gateway' &&
    component.configuration.endpointType === 'private'
  )
    return false;
  if (component.kind === 'load-balancer' || component.kind === 'api-gateway') {
    return (
      publicIngress(architecture, component, failed).reachable &&
      policyAllows(architecture, component, 'ingress', 'internet', 'HTTPS')
    );
  }
  return true;
}

/** Evaluate a modeled initiated connection, including its implicit route dependencies. */
export function connectionNetworkPath(
  architecture: Architecture,
  edge: ArchitectureConnection,
  failed: ReadonlySet<string> = new Set(),
): NetworkPath {
  const source = byId(architecture, edge.source);
  const target = byId(architecture, edge.target);
  if (
    !source ||
    !target ||
    !livePlacement(architecture, source, failed) ||
    !livePlacement(architecture, target, failed)
  )
    return path(
      false,
      'A connection endpoint or its network placement is unavailable.',
    );
  if (
    attachmentOnlyKinds.has(source.kind) ||
    attachmentOnlyKinds.has(target.kind)
  )
    return path(
      false,
      'Network boundaries and policies are attachments, not traffic hops.',
    );
  if (
    !policyAllows(architecture, source, 'egress', target, edge.protocol) ||
    !policyAllows(architecture, target, 'ingress', source, edge.protocol)
  )
    return path(
      false,
      'Attached security rules block this initiated connection.',
    );
  const sourceNetwork = virtualNetworkId(architecture, source);
  const targetNetwork = virtualNetworkId(architecture, target);
  if (source.kind === 'external-network' && target.kind === 'vpn-connection')
    return path(
      target.configuration.externalNetworkId === source.id &&
        Boolean(target.configuration.gatewayId) &&
        !failed.has(target.configuration.gatewayId),
      'External network to its configured VPN.',
      [target.id, target.configuration.gatewayId],
    );
  if (
    source.kind === 'vpn-connection' &&
    target.kind === 'virtual-private-gateway'
  )
    return path(
      source.configuration.gatewayId === target.id &&
        Boolean(source.configuration.externalNetworkId) &&
        !failed.has(source.configuration.externalNetworkId),
      'VPN to its configured private gateway.',
      [source.id, source.configuration.externalNetworkId],
    );
  if (source.kind === 'external-network' && targetNetwork)
    return (
      vpnPaths(architecture, target, source, failed).find(
        (result) => result.reachable,
      ) ??
      path(
        false,
        'The destination subnet needs a surviving VPN return route to this external network.',
      )
    );
  if (target.kind === 'external-network' && sourceNetwork)
    return (
      vpnPaths(architecture, source, target, failed).find(
        (result) => result.reachable,
      ) ?? path(false, 'No surviving VPN route to this external network.')
    );
  if (source.kind === 'virtual-private-gateway' && targetNetwork) {
    const vpns = architecture.components.filter(
      (item) =>
        item.kind === 'vpn-connection' &&
        item.configuration.gatewayId === source.id,
    );
    for (const vpn of vpns) {
      if (vpn.kind !== 'vpn-connection') continue;
      const external = byId(architecture, vpn.configuration.externalNetworkId);
      if (!external) continue;
      const route = vpnPaths(architecture, target, external, failed).find(
        (result) => result.reachable && result.dependencyIds.includes(vpn.id),
      );
      if (route) return route;
    }
    return path(
      false,
      'Private gateway traffic needs a VPN and a matching subnet return route.',
    );
  }
  if (sourceNetwork && target.kind === 'internet')
    return (
      internetPaths(architecture, source, failed, edge.protocol).find(
        (result) => result.reachable,
      ) ?? path(false, 'No surviving permitted internet route.')
    );
  if (
    targetNetwork &&
    ['internet', 'internet-gateway', 'cdn', 'dns'].includes(source.kind)
  )
    return publicIngress(architecture, target, failed);
  if (sourceNetwork && targetNetwork)
    return path(
      sourceNetwork === targetNetwork,
      sourceNetwork === targetNetwork
        ? 'Local virtual network route.'
        : 'No modeled route between these virtual networks.',
      [sourceNetwork, targetNetwork],
    );
  if (source.kind === 'private-endpoint')
    return path(
      source.configuration.serviceId === target.id &&
        Boolean(sourceNetwork) &&
        componentSubnets(architecture, source).length > 0,
      'Private endpoint to its configured managed service.',
      [source.id],
    );
  if (sourceNetwork && managedServiceKinds.has(target.kind)) {
    const endpoint = architecture.components.find(
      (item) =>
        item.kind === 'private-endpoint' &&
        item.configuration.serviceId === target.id &&
        virtualNetworkId(architecture, item) === sourceNetwork &&
        componentSubnets(architecture, item).length > 0 &&
        livePlacement(architecture, item, failed) &&
        policyAllows(architecture, item, 'ingress', source, edge.protocol),
    );
    if (endpoint)
      return path(true, 'Private service access through the endpoint.', [
        endpoint.id,
        ...componentSubnets(architecture, endpoint)
          .filter((subnet) => !failed.has(subnet.id))
          .map((subnet) => subnet.id),
      ]);
    if (target.kind === 'serverless-ai' && target.configuration.privateAccess)
      return path(
        false,
        'Private-only service access requires a surviving private endpoint.',
      );
    return (
      internetPaths(architecture, source, failed, edge.protocol).find(
        (result) => result.reachable,
      ) ??
      path(
        false,
        'Managed service access needs a private endpoint or permitted internet egress.',
      )
    );
  }
  if (
    !sourceNetwork &&
    targetNetwork &&
    componentSubnets(architecture, target).length
  )
    return publicIngress(architecture, target, failed);
  return path(true, 'Network placement is not modeled for this connection.');
}
