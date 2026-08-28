export const ARCHITECTURE_SCHEMA_VERSION = 1 as const;

export type JsonPrimitive = boolean | number | string | null;
export type JsonValue = JsonPrimitive | JsonValue[] | JsonObject;
export type JsonObject = { [key: string]: JsonValue };

export type CloudProvider = 'aws' | 'azure' | 'gcp' | 'cloudflare' | 'generic';

export type DeploymentEnvironment = 'development' | 'staging' | 'production';

export type ComponentCategory =
  'network' | 'compute' | 'data' | 'integration' | 'ai' | 'platform';

export const CONNECTION_TYPES = [
  'request',
  'async',
  'data',
  'replication',
  'trigger',
  'management',
] as const;

export type ConnectionType = (typeof CONNECTION_TYPES)[number];

export type Actor = 'human' | 'agent' | 'system';

export type NetworkRoute = {
  destination: 'internet' | 'external-network';
  targetId: string;
};

/** Allow rules for initiated connections; response traffic is stateful. */
export type NetworkRule = {
  peerId: string;
  protocol: string;
};

export type NetworkPlacement = {
  virtualNetworkId?: string;
  subnetIds?: string[];
  securityGroupIds?: string[];
  publicAddress?: boolean;
  internetAccessRequired?: boolean;
};

export type ComponentConfigurationMap = {
  'virtual-network': { cidr: string };
  subnet: {
    cidr: string;
    visibility: 'public' | 'private';
    routes: NetworkRoute[];
  };
  'nat-gateway': { monthlyDataGb: number };
  'security-group': { ingress: NetworkRule[]; egress: NetworkRule[] };
  'private-endpoint': { serviceId: string; monthlyDataGb: number };
  'external-network': { cidr: string };
  'vpn-connection': {
    gatewayId: string;
    externalNetworkId: string;
    tunnels: number;
    encrypted: boolean;
  };
  internet: {
    entryType: 'public-internet';
  };
  'internet-gateway': Record<string, never>;
  'virtual-private-gateway': {
    asn: number;
  };
  dns: {
    routingPolicy: 'simple' | 'latency' | 'failover';
    zoneType: 'public' | 'private';
  };
  cdn: {
    cachePolicy: 'managed' | 'custom';
    priceClass: 'regional' | 'all';
  };
  waf: {
    managedRules: boolean;
    rateLimiting: boolean;
  };
  'load-balancer': {
    scheme: 'internet-facing' | 'internal';
    crossZone: boolean;
  };
  'api-gateway': {
    endpointType: 'regional' | 'edge' | 'private';
    throttlingEnabled: boolean;
  };
  'virtual-machine': {
    instanceType: string;
    operatingSystem: 'linux' | 'windows';
    autoscaling: boolean;
  };
  'container-service': {
    launchType: 'fargate' | 'ec2';
    cpu: number;
    memoryMb: number;
    autoscaling: boolean;
  };
  'serverless-function': {
    runtime: string;
    memoryMb: number;
    timeoutSeconds: number;
  };
  worker: {
    runtime: 'edge';
    compatibilityDate?: string;
  };
  'serverless-ai': {
    modelId: string;
    modality: 'text' | 'multimodal' | 'embedding';
    guardrailsEnabled: boolean;
    privateAccess: boolean;
    encrypted: boolean;
    dataLogging: boolean;
  };
  'ai-agent': {
    orchestrationMode: 'single-agent' | 'supervisor' | 'collaborator';
    memoryEnabled: boolean;
    humanApprovalRequired: boolean;
    guardrailsEnabled: boolean;
    encrypted: boolean;
  };
  'sql-database': {
    engine: 'postgresql' | 'mysql';
    size: 'small' | 'medium' | 'large';
    multiAZ: boolean;
    storageGb: number;
    encrypted: boolean;
    backupsEnabled: boolean;
    publicAccess: boolean;
  };
  'nosql-database': {
    capacityMode: 'on-demand' | 'provisioned';
    encrypted: boolean;
    globalTables: boolean;
  };
  cache: {
    engine: 'redis';
    nodeType: string;
    clusterMode: boolean;
    encrypted: boolean;
  };
  'object-storage': {
    encrypted: boolean;
    publicAccess: boolean;
    versioning: boolean;
  };
  queue: {
    queueType: 'standard' | 'fifo';
    deadLetterQueue: boolean;
    encrypted: boolean;
  };
  'event-bus': {
    schemaRegistry: boolean;
    archiveEnabled: boolean;
  };
  identity: {
    identityType: 'workforce' | 'customer' | 'service';
    mfaRequired: boolean;
  };
  'secrets-manager': {
    automaticRotation: boolean;
    encrypted: boolean;
  };
  monitoring: {
    logRetentionDays: number;
    alertingEnabled: boolean;
  };
};

export type ComponentKind = keyof ComponentConfigurationMap;

export type ComponentPosition = {
  x: number;
  y: number;
};

export type ArchitectureComponentBase<K extends ComponentKind> = {
  id: string;
  name: string;
  kind: K;
  provider: CloudProvider;
  service: string;
  region: string;
  availabilityZones: string[];
  replicas: number;
  configuration: ComponentConfigurationMap[K];
  estimatedMonthlyCost: number;
  locked: boolean;
  critical: boolean;
  position: ComponentPosition;
  metadata: JsonObject;
  network?: NetworkPlacement;
};

export type ArchitectureComponent = {
  [K in ComponentKind]: ArchitectureComponentBase<K>;
}[ComponentKind];

export type ComponentOfKind<K extends ComponentKind> = Extract<
  ArchitectureComponent,
  { kind: K }
>;

export type ArchitectureConnection = {
  id: string;
  source: string;
  target: string;
  type: ConnectionType;
  protocol?: string;
  encrypted: boolean;
  critical: boolean;
  metadata: JsonObject;
};

export type ArchitectureConstraints = {
  maximumMonthlyCost?: number;
  targetResilienceScore?: number;
  targetSecurityScore?: number;
  requiredRegion?: string;
  requireMultiAZ: boolean;
  requireEncryptionAtRest: boolean;
  notes?: string | JsonObject;
};

export type ProviderContext = {
  provider: CloudProvider;
  environment: DeploymentEnvironment;
  accountReference?: string;
};

export type Architecture = {
  schemaVersion: typeof ARCHITECTURE_SCHEMA_VERSION;
  revision: number;
  id: string;
  name: string;
  description: string;
  provider: ProviderContext;
  region: string;
  components: ArchitectureComponent[];
  connections: ArchitectureConnection[];
  constraints: ArchitectureConstraints;
  metadata: JsonObject;
};

export type ArchitectureAction =
  | 'architecture.created'
  | 'architecture.loaded'
  | 'architecture.renamed'
  | 'architecture.reset'
  | 'component.added'
  | 'component.updated'
  | 'component.removed'
  | 'component.locked'
  | 'component.unlocked'
  | 'component.moved'
  | 'connection.created'
  | 'connection.updated'
  | 'connection.removed'
  | 'constraints.updated'
  | 'history.undo'
  | 'history.redo'
  | 'webmcp.analysis.completed'
  | 'webmcp.simulation.completed'
  | 'webmcp.action.blocked'
  | 'webmcp.action.failed';

export type ActivityEntry = {
  id: string;
  timestamp: string;
  actor: Actor;
  action: ArchitectureAction;
  summary: string;
  details?: JsonObject;
};

export type CreateArchitectureInput = {
  id?: string;
  name: string;
  description?: string;
  provider?: ProviderContext;
  region?: string;
  constraints?: Partial<ArchitectureConstraints>;
  metadata?: JsonObject;
};

type AddComponentCommon<K extends ComponentKind> = {
  kind: K;
  id?: string;
  name?: string;
  provider?: CloudProvider;
  service?: string;
  region?: string;
  availabilityZones?: string[];
  replicas?: number;
  configuration?: Partial<ComponentConfigurationMap[K]>;
  estimatedMonthlyCost?: number;
  locked?: boolean;
  critical?: boolean;
  position?: ComponentPosition;
  metadata?: JsonObject;
  network?: NetworkPlacement;
};

export type AddComponentInput =
  | {
      [K in ComponentKind]: AddComponentCommon<K>;
    }[ComponentKind]
  | (Omit<AddComponentCommon<ComponentKind>, 'configuration'> & {
      configuration?: never;
    });

export type ComponentUpdate<K extends ComponentKind = ComponentKind> = {
  name?: string;
  provider?: CloudProvider;
  service?: string;
  region?: string;
  availabilityZones?: string[];
  replicas?: number;
  configuration?: Partial<ComponentConfigurationMap[K]>;
  estimatedMonthlyCost?: number;
  critical?: boolean;
  metadata?: JsonObject;
  network?: NetworkPlacement;
};

export type ConnectComponentsInput = {
  id?: string;
  source: string;
  target: string;
  type: ConnectionType;
  protocol?: string;
  encrypted?: boolean;
  critical?: boolean;
  metadata?: JsonObject;
};

export type ConnectionUpdate = {
  type?: ConnectionType;
  protocol?: string;
  encrypted?: boolean;
  critical?: boolean;
  metadata?: JsonObject;
};
