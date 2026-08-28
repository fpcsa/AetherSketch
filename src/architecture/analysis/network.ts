import type { Architecture } from '../model';
import {
  attachmentOnlyKinds,
  componentSubnets,
  effectiveZones,
  subnetKinds,
} from '../network/structure';
import { connectionNetworkPath, internetPaths } from '../network/routing';
import { createFinding } from './finding';
import type { ArchitectureFinding } from './types';

export function analyzeNetwork(
  architecture: Architecture,
): ArchitectureFinding[] {
  const findings: ArchitectureFinding[] = [];
  const add = (input: Omit<ArchitectureFinding, 'id' | 'deterministic'>) =>
    findings.push(
      createFinding({
        ...input,
        id: `network:${input.code}:${input.componentId ?? input.edgeId ?? 'architecture'}`,
      }),
    );
  for (const component of architecture.components) {
    const subnets = componentSubnets(architecture, component);
    const common = {
      componentId: component.id,
      evidence: { componentId: component.id },
    };
    if (
      [
        'subnet',
        'internet-gateway',
        'virtual-private-gateway',
        'security-group',
      ].includes(component.kind) &&
      !component.network?.virtualNetworkId &&
      (component.kind === 'subnet' ||
        component.kind === 'security-group' ||
        architecture.components.some((item) => item.kind === 'virtual-network'))
    ) {
      add({
        ...common,
        code: 'NETWORK_ATTACHMENT_MISSING',
        category: 'validation',
        severity: 'high',
        title: 'Network attachment is missing',
        message: `${component.name} is not attached to a virtual network.`,
        remediation: 'Select its virtual network in Network placement.',
      });
    }
    if (
      (component.kind === 'nat-gateway' ||
        component.kind === 'private-endpoint' ||
        (component.network?.virtualNetworkId &&
          subnetKinds.has(component.kind))) &&
      subnets.length === 0
    ) {
      add({
        ...common,
        code: 'SUBNET_PLACEMENT_MISSING',
        category: 'validation',
        severity: 'high',
        title: 'Subnet placement is missing',
        message: `${component.name} needs a subnet to model network connectivity.`,
        remediation:
          'Assign subnets in Network placement. NAT gateways require one public subnet.',
      });
    }
    if (
      component.kind === 'private-endpoint' &&
      !component.configuration.serviceId
    )
      add({
        ...common,
        code: 'ENDPOINT_SERVICE_MISSING',
        category: 'validation',
        severity: 'high',
        title: 'Private endpoint has no service',
        message: `${component.name} has no target managed service.`,
        remediation: 'Select the managed service this endpoint exposes.',
      });
    if (component.kind === 'vpn-connection') {
      if (
        !component.configuration.gatewayId ||
        !component.configuration.externalNetworkId
      )
        add({
          ...common,
          code: 'VPN_ATTACHMENT_MISSING',
          category: 'validation',
          severity: 'high',
          title: 'VPN connection is incomplete',
          message: `${component.name} needs both a private gateway and an external network.`,
          remediation:
            'Select both ends of the VPN and add an external-network route to each participating subnet.',
        });
      if (!component.configuration.encrypted)
        add({
          ...common,
          code: 'VPN_UNENCRYPTED',
          category: 'security',
          severity: 'critical',
          title: 'VPN encryption is disabled',
          message: `${component.name} does not protect traffic in transit.`,
          remediation: 'Enable VPN encryption.',
          evidence: { scoreDelta: -15 },
        });
      if (component.configuration.tunnels === 1)
        add({
          ...common,
          code: 'VPN_SINGLE_TUNNEL',
          category: 'resilience',
          severity: 'medium',
          title: 'VPN has one tunnel',
          message: `${component.name} has no second modeled tunnel.`,
          remediation:
            'Model both VPN tunnels and test the external gateway recovery plan.',
          evidence: { scoreDelta: -4 },
        });
    }
    if (component.kind === 'nat-gateway') {
      const subnet = subnets[0];
      const route = subnet?.configuration.routes.find(
        (item) => item.destination === 'internet',
      );
      const target = architecture.components.find(
        (item) => item.id === route?.targetId,
      );
      if (
        !subnet ||
        subnet.configuration.visibility !== 'public' ||
        target?.kind !== 'internet-gateway'
      )
        add({
          ...common,
          code: 'NAT_PUBLIC_ROUTE_MISSING',
          category: 'validation',
          severity: 'high',
          title: 'NAT has no public route',
          message: `${component.name} needs a public subnet with an Internet Gateway route.`,
          remediation:
            'Place this zonal NAT in a public subnet and configure its internet route.',
        });
    }
    if (component.network?.internetAccessRequired) {
      const routes = internetPaths(architecture, component);
      const blocked = routes.filter((route) => !route.reachable);
      if (blocked.length)
        add({
          ...common,
          code: 'INTERNET_EGRESS_UNREACHABLE',
          category: 'validation',
          severity: 'high',
          title: 'Workload cannot reach the internet',
          message: `${component.name}: ${blocked.length === routes.length ? 'no modeled placement can' : 'some subnet placements cannot'} reach the internet over HTTPS. ${blocked[0].reason}`,
          remediation:
            'For private subnets, route through a NAT in a public subnet with an Internet Gateway route. Allow HTTPS egress in attached security rules.',
          evidence: {
            subnetIds: blocked.map((route) => route.subnetId ?? ''),
            reasons: blocked.map((route) => route.reason),
          },
        });
      const natIds = [
        ...new Set(
          routes
            .map((route) => route.natGatewayId)
            .filter((id): id is string => Boolean(id)),
        ),
      ];
      if (
        natIds.length === 1 &&
        routes.every((route) => route.natGatewayId === natIds[0])
      ) {
        const nat = architecture.components.find(
          (item) => item.id === natIds[0],
        )!;
        add({
          ...common,
          code: 'NAT_SINGLE_ZONE_DEPENDENCY',
          category: 'resilience',
          severity: 'high',
          title: 'Internet egress depends on one NAT zone',
          message: `${component.name} depends on ${nat.name} in ${effectiveZones(architecture, nat).join(', ') || 'an unassigned zone'} for internet egress.`,
          remediation:
            'Use a NAT in each workload zone and give each private subnet a route to its local NAT.',
          evidence: {
            natGatewayId: nat.id,
            availabilityZones: effectiveZones(architecture, nat),
            scoreDelta: component.critical ? -8 : -3,
          },
        });
      }
      for (const route of routes) {
        if (!route.natGatewayId || !route.subnetId) continue;
        const nat = architecture.components.find(
          (item) => item.id === route.natGatewayId,
        )!;
        const subnet = subnets.find((item) => item.id === route.subnetId)!;
        if (
          !effectiveZones(architecture, nat).includes(
            subnet.availabilityZones[0],
          )
        ) {
          add({
            ...common,
            code: `NAT_CROSS_ZONE_ROUTE_${subnet.id}`,
            category: 'resilience',
            severity: 'medium',
            title: 'Internet route crosses availability zones',
            message: `${component.name} in ${subnet.availabilityZones[0]} depends on ${nat.name} in another zone.`,
            remediation: 'Route this subnet through a NAT in the same zone.',
            evidence: {
              subnetId: subnet.id,
              natGatewayId: nat.id,
              scoreDelta: -2,
            },
          });
        }
      }
    }
    if (
      subnets.length &&
      component.kind !== 'nat-gateway' &&
      !component.network?.securityGroupIds?.length
    )
      add({
        ...common,
        code: 'NETWORK_POLICY_UNMODELED',
        category: 'security',
        severity: 'medium',
        title: 'Network security rules are not modeled',
        message: `${component.name} has subnet placement but no attached network security rules. Reachability assumes its traffic is permitted.`,
        remediation:
          'Attach Network Security Rules with explicit ingress and egress permissions.',
        evidence: { scoreDelta: -3 },
      });
    if (
      (component.kind === 'sql-database' || component.kind === 'cache') &&
      subnets.some((subnet) => subnet.configuration.visibility === 'public')
    )
      add({
        ...common,
        code: 'DATA_IN_PUBLIC_SUBNET',
        category: 'security',
        severity: 'high',
        title: 'Data tier uses a public subnet',
        message: `${component.name} is placed in a subnet intended for public routing. This placement alone does not prove public exposure.`,
        remediation:
          'Move the data tier to private subnets and restrict ingress to application workloads.',
        evidence: { scoreDelta: -8 },
      });
    if (
      component.kind === 'security-group' &&
      component.configuration.ingress.some(
        (rule) =>
          ['*', 'internet'].includes(rule.peerId) && rule.protocol === '*',
      )
    )
      add({
        ...common,
        code: 'NETWORK_INGRESS_UNRESTRICTED',
        category: 'security',
        severity: 'high',
        title: 'Inbound network rule is unrestricted',
        message: `${component.name} allows all protocols from any or public peers.`,
        remediation: 'Limit ingress to the expected peers and protocol labels.',
        evidence: { scoreDelta: -8 },
      });
  }
  for (const edge of architecture.connections) {
    const result = connectionNetworkPath(architecture, edge);
    if (!result.reachable)
      add({
        code: 'NETWORK_CONNECTION_BLOCKED',
        category: result.reason.includes('security rules')
          ? 'security'
          : 'validation',
        severity: 'high',
        edgeId: edge.id,
        title: 'Connection blocked by the network model',
        message: result.reason,
        remediation:
          'Inspect subnet placement, routes, endpoint/VPN attachments and allow rules for this connection.',
        evidence: {
          source: edge.source,
          target: edge.target,
          dependencyIds: result.dependencyIds,
          scoreDelta: -5,
        },
      });
  }
  return findings;
}

export { attachmentOnlyKinds };
