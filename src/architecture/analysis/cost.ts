import { getCatalogEntry } from '../catalog';
import type { Architecture, ArchitectureComponent } from '../model';
import { createFinding } from './finding';
import type {
  ComponentCostEstimate,
  CostEstimate,
  CostMultiplier,
} from './types';

function roundMoney(value: number): number {
  return Math.round(value * 100) / 100;
}

function addMultiplier(
  multipliers: CostMultiplier[],
  code: string,
  label: string,
  value: number,
) {
  if (value !== 1) {
    multipliers.push({ code, label, value });
  }
}

function componentMultipliers(
  component: ArchitectureComponent,
): CostMultiplier[] {
  const multipliers: CostMultiplier[] = [];

  switch (component.kind) {
    case 'virtual-machine': {
      const knownSizes: Record<string, number> = {
        't3.small': 0.7,
        't3.medium': 1,
        't3.large': 1.8,
      };
      addMultiplier(
        multipliers,
        'INSTANCE_SIZE',
        `Instance type ${component.configuration.instanceType}`,
        knownSizes[component.configuration.instanceType] ?? 1.25,
      );
      addMultiplier(
        multipliers,
        'REPLICAS',
        `${component.replicas} modeled replicas`,
        component.replicas,
      );
      break;
    }
    case 'container-service': {
      const resourceMultiplier = Math.max(
        component.configuration.cpu / 512,
        component.configuration.memoryMb / 1024,
      );
      addMultiplier(
        multipliers,
        'TASK_SIZE',
        `${component.configuration.cpu} CPU units / ${component.configuration.memoryMb} MB`,
        resourceMultiplier,
      );
      addMultiplier(
        multipliers,
        'REPLICAS',
        `${component.replicas} modeled replicas`,
        component.replicas,
      );
      break;
    }
    case 'serverless-function':
      addMultiplier(
        multipliers,
        'FUNCTION_MEMORY',
        `${component.configuration.memoryMb} MB function memory`,
        Math.max(0.5, component.configuration.memoryMb / 512),
      );
      break;
    case 'serverless-ai': {
      const modalityMultipliers = {
        text: 1,
        multimodal: 1.45,
        embedding: 0.65,
      };
      addMultiplier(
        multipliers,
        'AI_MODALITY',
        `${component.configuration.modality} model workload`,
        modalityMultipliers[component.configuration.modality],
      );
      addMultiplier(
        multipliers,
        'AI_GUARDRAILS',
        'Managed AI guardrails',
        component.configuration.guardrailsEnabled ? 1.05 : 1,
      );
      break;
    }
    case 'ai-agent': {
      const orchestrationMultipliers = {
        'single-agent': 1,
        supervisor: 1.6,
        collaborator: 1.3,
      };
      addMultiplier(
        multipliers,
        'AGENT_ORCHESTRATION',
        `${component.configuration.orchestrationMode} orchestration`,
        orchestrationMultipliers[component.configuration.orchestrationMode],
      );
      addMultiplier(
        multipliers,
        'AGENT_MEMORY',
        'Managed agent memory',
        component.configuration.memoryEnabled ? 1.1 : 1,
      );
      break;
    }
    case 'sql-database': {
      const sizeMultipliers = { small: 0.65, medium: 1, large: 1.85 };
      addMultiplier(
        multipliers,
        'DATABASE_SIZE',
        `${component.configuration.size} database tier`,
        sizeMultipliers[component.configuration.size],
      );
      addMultiplier(
        multipliers,
        'MULTI_AZ',
        'Multi-AZ standby capacity',
        component.configuration.multiAZ ? 1.6 : 1,
      );
      addMultiplier(
        multipliers,
        'STORAGE',
        `${component.configuration.storageGb} GB modeled storage`,
        1 + Math.max(0, component.configuration.storageGb - 100) * 0.0015,
      );
      break;
    }
    case 'nosql-database':
      addMultiplier(
        multipliers,
        'GLOBAL_TABLES',
        'Global table replication',
        component.configuration.globalTables ? 2 : 1,
      );
      break;
    case 'cache':
      addMultiplier(
        multipliers,
        'CACHE_REPLICAS',
        `${component.replicas} cache nodes`,
        component.replicas,
      );
      addMultiplier(
        multipliers,
        'CLUSTER_MODE',
        'Cluster mode capacity',
        component.configuration.clusterMode ? 1.5 : 1,
      );
      break;
    case 'cdn':
      addMultiplier(
        multipliers,
        'PRICE_CLASS',
        `${component.configuration.priceClass} edge footprint`,
        component.configuration.priceClass === 'all' ? 1.35 : 1,
      );
      break;
    case 'queue':
      addMultiplier(
        multipliers,
        'QUEUE_TYPE',
        `${component.configuration.queueType} queue`,
        component.configuration.queueType === 'fifo' ? 1.15 : 1,
      );
      break;
    case 'object-storage':
      addMultiplier(
        multipliers,
        'VERSIONING',
        'Object version retention',
        component.configuration.versioning ? 1.1 : 1,
      );
      break;
    default:
      break;
  }

  return multipliers;
}

function estimateComponentCost(
  component: ArchitectureComponent,
): ComponentCostEstimate {
  const catalog = getCatalogEntry(component.kind);
  const multipliers = componentMultipliers(component);
  const multiplierProduct = multipliers.reduce(
    (product, multiplier) => product * multiplier.value,
    1,
  );
  const estimatedMonthlyCost = roundMoney(
    catalog.baseMonthlyEstimate * multiplierProduct,
  );

  return {
    componentId: component.id,
    componentName: component.name,
    kind: component.kind,
    baseMonthlyCost: catalog.baseMonthlyEstimate,
    multipliers,
    estimatedMonthlyCost,
    explanation:
      component.kind === 'internet-gateway'
        ? 'Gateway resource only: $0/month in this planning model. Traffic charges are excluded.'
        : component.kind === 'virtual-private-gateway'
          ? 'Gateway resource only: $0/month in this planning model. VPN connections, dedicated links, and traffic charges are excluded.'
          : multipliers.length === 0
            ? `Catalog baseline of $${catalog.baseMonthlyEstimate}/month.`
            : `Catalog baseline adjusted by ${multipliers.map((item) => item.label).join(', ')}.`,
  };
}

export function estimateArchitectureCost(
  architecture: Architecture,
): CostEstimate {
  const components = architecture.components.map(estimateComponentCost);
  const totalEstimatedMonthlyCost = roundMoney(
    components.reduce(
      (total, component) => total + component.estimatedMonthlyCost,
      0,
    ),
  );

  return {
    label: 'Estimated architecture cost',
    currency: 'USD',
    period: 'month',
    totalEstimatedMonthlyCost,
    components,
    assumptions: [
      'Catalog baselines represent simplified planning values, not provider price-sheet calculations.',
      'Replica, capacity tier, Multi-AZ, and selected service settings use explicit deterministic multipliers.',
      'Request volume, data transfer, discounts, taxes, support plans, and regional price variation are excluded.',
    ],
    disclaimer:
      'Estimated architecture cost is a planning model and is not a cloud billing quote.',
    findings: [
      createFinding({
        id: 'cost:planning-model',
        code: 'COST_PLANNING_MODEL',
        category: 'cost',
        severity: 'info',
        title: 'Simplified planning estimate',
        message: `The modeled architecture is estimated at $${totalEstimatedMonthlyCost.toFixed(2)} per month.`,
        remediation:
          'Validate usage assumptions with the cloud provider calculator before a purchasing decision.',
        evidence: {
          currency: 'USD',
          period: 'month',
          componentCount: components.length,
          totalEstimatedMonthlyCost,
        },
      }),
    ],
  };
}
