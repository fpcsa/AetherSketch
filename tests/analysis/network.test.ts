import { describe, expect, it } from 'vitest';
import {
  analyzeArchitecture,
  analyzeSecurity,
  estimateArchitectureCost,
} from '../../src/architecture/analysis';
import {
  architectureSchema,
  validateArchitecture,
} from '../../src/architecture/model';
import {
  connectionNetworkPath,
  internetPaths,
} from '../../src/architecture/network/routing';
import { effectiveZones } from '../../src/architecture/network/structure';
import {
  serializeArchitecture,
  deserializeArchitecture,
} from '../../src/architecture/serialization';
import { getArchitectureTemplate } from '../../src/templates';
import { createComponentFromCatalog } from '../../src/architecture/catalog';
import { simulateFailure } from '../../src/architecture/simulation';

describe('network membership, routing and policy analysis', () => {
  it('uses subnet-derived zones for constraints, endpoint cost and surviving capacity', () => {
    const architecture = getArchitectureTemplate('private-network');
    architecture.components.push(
      createComponentFromCatalog(
        {
          id: 'private-a',
          kind: 'subnet',
          network: { virtualNetworkId: 'net-vpc' },
          configuration: {
            cidr: '10.0.4.0/24',
            routes: [{ destination: 'external-network', targetId: 'net-vpn' }],
          },
        },
        { provider: 'generic', region: architecture.region },
      ),
    );
    for (const component of architecture.components.filter(
      (item) => item.id === 'net-app' || item.id === 'net-endpoint',
    )) {
      component.network!.subnetIds = ['private-a', 'net-private-b'];
      component.network!.internetAccessRequired = false;
      component.availabilityZones = ['eu-west-1a'];
    }
    architecture.constraints.requireMultiAZ = true;
    const result = analyzeArchitecture(architecture);
    expect(
      result.constraints.results.find((item) => item.id === 'multi-az-required')
        ?.status,
    ).toBe('met');
    expect(
      result.cost.components.find((item) => item.componentId === 'net-endpoint')
        ?.estimatedMonthlyCost,
    ).toBe(17);
    const failure = simulateFailure(architecture, {
      scope: 'availability-zone',
      target: 'eu-west-1a',
    });
    expect(failure.criticalPathsRemaining).toBe(true);
    expect(failure.degradedComponentIds).toEqual(
      expect.arrayContaining(['net-app', 'net-endpoint']),
    );
  });
  it('round-trips routes, policy attachments, endpoints and VPNs without changing IR during analysis', () => {
    const architecture = getArchitectureTemplate('private-network');
    const before = serializeArchitecture(architecture);
    const result = analyzeArchitecture(architecture);
    expect(result.validationStatus).toBe('valid');
    expect(
      result.findings.some(
        (finding) => finding.code === 'NAT_SINGLE_ZONE_DEPENDENCY',
      ),
    ).toBe(true);
    expect(
      result.findings.some(
        (finding) => finding.code === 'NETWORK_CONNECTION_BLOCKED',
      ),
    ).toBe(false);
    expect(deserializeArchitecture(before)).toEqual(architecture);
    expect(serializeArchitecture(architecture)).toBe(before);
    const app = architecture.components.find(
      (component) => component.id === 'net-app',
    )!;
    expect(internetPaths(architecture, app)).toMatchObject([
      { reachable: true, natGatewayId: 'net-nat-a', subnetId: 'net-private-b' },
    ]);
    expect(effectiveZones(architecture, app)).toEqual(['eu-west-1b']);
  });

  it('requires both a NAT route and a public-subnet Internet Gateway route', () => {
    const architecture = getArchitectureTemplate('private-network');
    const subnet = architecture.components.find(
      (component) => component.id === 'net-public-a',
    )!;
    if (subnet.kind !== 'subnet') throw new Error('Expected subnet');
    subnet.configuration.routes = [];
    const findings = analyzeArchitecture(architecture).findings;
    expect(findings.map((finding) => finding.code)).toEqual(
      expect.arrayContaining([
        'NAT_PUBLIC_ROUTE_MISSING',
        'INTERNET_EGRESS_UNREACHABLE',
      ]),
    );
    expect(
      findings.find((finding) => finding.code === 'INTERNET_EGRESS_UNREACHABLE')
        ?.message,
    ).toContain('no modeled placement can');
    subnet.configuration.routes = [
      { destination: 'internet', targetId: 'net-nat-a' },
    ];
    expect(
      analyzeArchitecture(architecture).findings.some(
        (finding) => finding.code === 'INTERNET_EGRESS_UNREACHABLE',
      ),
    ).toBe(true);
  });

  it('blocks unsolicited public ingress to private workloads even when NAT permits egress', () => {
    const architecture = getArchitectureTemplate('private-network');
    const app = architecture.components.find(
      (component) => component.id === 'net-app',
    )!;
    app.network!.securityGroupIds = [];
    const edge = { ...architecture.connections[0], source: 'net-internet' };
    expect(connectionNetworkPath(architecture, edge).reachable).toBe(false);
    const subnet = architecture.components.find(
      (component) => component.id === 'net-private-b',
    )!;
    if (subnet.kind !== 'subnet') throw new Error('Expected subnet');
    subnet.configuration.visibility = 'public';
    subnet.configuration.routes = [
      { destination: 'internet', targetId: 'net-igw' },
    ];
    expect(connectionNetworkPath(architecture, edge).reachable).toBe(false);
    app.network!.publicAddress = true;
    expect(connectionNetworkPath(architecture, edge).reachable).toBe(true);
  });

  it('enforces attached allow rules and reports unsafe broad ingress', () => {
    const architecture = getArchitectureTemplate('private-network');
    const group = architecture.components.find(
      (component) => component.kind === 'security-group',
    )!;
    if (group.kind !== 'security-group') throw new Error('Expected rules');
    group.configuration.ingress = [];
    expect(
      connectionNetworkPath(architecture, architecture.connections[0])
        .reachable,
    ).toBe(false);
    expect(
      analyzeSecurity(architecture).findings.some(
        (finding) => finding.code === 'NETWORK_CONNECTION_BLOCKED',
      ),
    ).toBe(true);
    group.configuration.ingress = [
      { peerId: 'net-external', protocol: 'https' },
    ];
    expect(
      connectionNetworkPath(architecture, architecture.connections[0])
        .reachable,
    ).toBe(true);
    group.configuration.egress = [];
    expect(
      analyzeArchitecture(architecture).findings.some(
        (finding) => finding.code === 'INTERNET_EGRESS_UNREACHABLE',
      ),
    ).toBe(true);
    group.configuration.ingress = [{ peerId: '*', protocol: '*' }];
    expect(
      analyzeSecurity(architecture).findings.some(
        (finding) => finding.code === 'NETWORK_INGRESS_UNRESTRICTED',
      ),
    ).toBe(true);
  });

  it('uses a private endpoint without an internet route and requires VPN return routes', () => {
    const architecture = getArchitectureTemplate('private-network');
    const subnet = architecture.components.find(
      (component) => component.id === 'net-private-b',
    )!;
    if (subnet.kind !== 'subnet') throw new Error('Expected subnet');
    subnet.configuration.routes = [];
    const serviceEdge = architecture.connections[1];
    const privatePath = connectionNetworkPath(architecture, serviceEdge);
    expect(privatePath.reachable).toBe(true);
    expect(privatePath.dependencyIds).toContain('net-endpoint');
    expect(
      connectionNetworkPath(
        architecture,
        serviceEdge,
        new Set(['net-endpoint']),
      ).reachable,
    ).toBe(false);
    expect(
      connectionNetworkPath(architecture, architecture.connections[0])
        .reachable,
    ).toBe(false);
    subnet.configuration.routes = [
      { destination: 'external-network', targetId: 'net-vpn' },
    ];
    expect(
      connectionNetworkPath(architecture, architecture.connections[0])
        .reachable,
    ).toBe(true);
    expect(
      connectionNetworkPath(
        architecture,
        architecture.connections[0],
        new Set(['net-vpg']),
      ).reachable,
    ).toBe(false);
  });

  it('rejects dangling references, wrong kinds, region mismatches, overlapping subnets and traffic through policy containers', () => {
    const make = () => getArchitectureTemplate('private-network');
    const mutations = [
      (architecture: ReturnType<typeof make>) => {
        architecture.components.find(
          (component) => component.id === 'net-app',
        )!.network!.subnetIds = ['missing'];
      },
      (architecture: ReturnType<typeof make>) => {
        architecture.components.find(
          (component) => component.id === 'net-app',
        )!.network!.virtualNetworkId = 'net-queue';
      },
      (architecture: ReturnType<typeof make>) => {
        architecture.components.find(
          (component) => component.id === 'net-app',
        )!.region = 'us-east-1';
      },
      (architecture: ReturnType<typeof make>) => {
        const subnet = architecture.components.find(
          (component) => component.id === 'net-private-b',
        )!;
        if (subnet.kind === 'subnet') subnet.configuration.cidr = '10.0.1.0/24';
      },
      (architecture: ReturnType<typeof make>) => {
        const subnet = architecture.components.find(
          (component) => component.id === 'net-private-b',
        )!;
        if (subnet.kind === 'subnet')
          subnet.configuration.cidr = '192.168.0.0/24';
      },
      (architecture: ReturnType<typeof make>) => {
        architecture.connections[0].target = 'net-rules';
      },
    ];
    for (const mutate of mutations) {
      const architecture = make();
      mutate(architecture);
      expect(architectureSchema.safeParse(architecture).success).toBe(false);
    }
    expect(() => validateArchitecture(make())).not.toThrow();
  });

  it('charges explicit NAT processing, endpoint zones and VPN baseline independently', () => {
    const architecture = getArchitectureTemplate('private-network');
    const costs = estimateArchitectureCost(architecture);
    expect(costs.totalEstimatedMonthlyCost).toBe(373.5);
    expect(
      costs.components.find(
        (component) => component.componentId === 'net-nat-a',
      )?.estimatedMonthlyCost,
    ).toBe(40);
    expect(
      costs.components.find(
        (component) => component.componentId === 'net-endpoint',
      )?.estimatedMonthlyCost,
    ).toBe(9);
    expect(
      costs.components.find((component) => component.componentId === 'net-vpn')
        ?.estimatedMonthlyCost,
    ).toBe(36.5);
  });
});
