import { createComponentFromCatalog } from '../architecture/catalog';
import {
  createEmptyArchitecture,
  validateArchitecture,
  type AddComponentInput,
} from '../architecture/model';

export function createPrivateNetworkTemplate() {
  const context = { provider: 'generic' as const, region: 'eu-west-1' };
  const component = (input: AddComponentInput) =>
    createComponentFromCatalog(input, context);
  return validateArchitecture({
    ...createEmptyArchitecture({
      id: 'architecture-private-network',
      name: 'Private Network & Hybrid Access',
      provider: { provider: 'generic', environment: 'production' },
    }),
    description:
      'A private workload in zone b uses a NAT in zone a. Simulate eu-west-1a to expose the dependency, then add a local NAT route. Includes a private service endpoint and VPN access.',
    metadata: {
      templateId: 'private-network',
      tags: ['network', 'routing', 'hybrid'],
    },
    components: [
      component({
        id: 'net-internet',
        kind: 'internet',
        name: 'Public Internet',
        position: { x: 40, y: 80 },
      }),
      component({
        id: 'net-external',
        kind: 'external-network',
        name: 'Office Network',
        region: 'external',
        position: { x: 40, y: 330 },
      }),
      component({
        id: 'net-vpn',
        kind: 'vpn-connection',
        name: 'Office VPN',
        configuration: {
          gatewayId: 'net-vpg',
          externalNetworkId: 'net-external',
        },
        position: { x: 40, y: 550 },
      }),
      component({
        id: 'net-vpc',
        kind: 'virtual-network',
        name: 'Application Network',
        position: { x: 300, y: 160 },
      }),
      component({
        id: 'net-public-a',
        kind: 'subnet',
        name: 'Public A',
        network: { virtualNetworkId: 'net-vpc' },
        configuration: {
          cidr: '10.0.1.0/24',
          visibility: 'public',
          routes: [{ destination: 'internet', targetId: 'net-igw' }],
        },
        position: { x: 330, y: 280 },
      }),
      component({
        id: 'net-private-b',
        kind: 'subnet',
        name: 'Private B',
        availabilityZones: ['eu-west-1b'],
        network: { virtualNetworkId: 'net-vpc' },
        configuration: {
          cidr: '10.0.2.0/24',
          visibility: 'private',
          routes: [
            { destination: 'internet', targetId: 'net-nat-a' },
            { destination: 'external-network', targetId: 'net-vpn' },
          ],
        },
        position: { x: 650, y: 280 },
      }),
      component({
        id: 'net-igw',
        kind: 'internet-gateway',
        name: 'Internet Gateway',
        network: { virtualNetworkId: 'net-vpc' },
        position: { x: 350, y: 110 },
      }),
      component({
        id: 'net-vpg',
        kind: 'virtual-private-gateway',
        name: 'Private Gateway',
        network: { virtualNetworkId: 'net-vpc' },
        position: { x: 630, y: 110 },
      }),
      component({
        id: 'net-nat-a',
        kind: 'nat-gateway',
        name: 'NAT A',
        network: { virtualNetworkId: 'net-vpc', subnetIds: ['net-public-a'] },
        configuration: { monthlyDataGb: 100 },
        position: { x: 350, y: 350 },
      }),
      component({
        id: 'net-rules',
        kind: 'security-group',
        name: 'Application Rules',
        network: { virtualNetworkId: 'net-vpc' },
        configuration: {
          ingress: [
            { peerId: 'net-external', protocol: 'HTTPS' },
            { peerId: 'net-app', protocol: 'HTTPS' },
          ],
          egress: [{ peerId: '*', protocol: 'HTTPS' }],
        },
        position: { x: 910, y: 110 },
      }),
      component({
        id: 'net-app',
        kind: 'container-service',
        name: 'Private Application',
        critical: true,
        replicas: 2,
        availabilityZones: ['eu-west-1b'],
        network: {
          virtualNetworkId: 'net-vpc',
          subnetIds: ['net-private-b'],
          securityGroupIds: ['net-rules'],
          internetAccessRequired: true,
        },
        position: { x: 680, y: 350 },
      }),
      component({
        id: 'net-endpoint',
        kind: 'private-endpoint',
        name: 'Queue Private Endpoint',
        network: {
          virtualNetworkId: 'net-vpc',
          subnetIds: ['net-private-b'],
          securityGroupIds: ['net-rules'],
        },
        configuration: { serviceId: 'net-queue', monthlyDataGb: 100 },
        position: { x: 680, y: 550 },
      }),
      component({
        id: 'net-queue',
        kind: 'queue',
        name: 'Managed Queue',
        position: { x: 40, y: 770 },
      }),
    ],
    connections: [
      {
        id: 'net-office-app',
        source: 'net-external',
        target: 'net-app',
        type: 'request',
        protocol: 'HTTPS',
        encrypted: true,
        critical: true,
        metadata: {},
      },
      {
        id: 'net-app-queue',
        source: 'net-app',
        target: 'net-queue',
        type: 'async',
        protocol: 'HTTPS',
        encrypted: true,
        critical: true,
        metadata: {},
      },
    ],
  });
}
