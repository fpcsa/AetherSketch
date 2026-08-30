import type { Architecture, JsonObject, JsonValue } from '../model';

export type FindingSeverity = 'critical' | 'high' | 'medium' | 'low' | 'info';

export type FindingCategory =
  'validation' | 'cost' | 'resilience' | 'security' | 'simulation';

export type ArchitectureFinding = {
  id: string;
  code: string;
  category: FindingCategory;
  severity: FindingSeverity;
  componentId?: string;
  edgeId?: string;
  title: string;
  message: string;
  remediation: string;
  evidence: JsonObject;
  deterministic: true;
};

export type ValidationAnalysis = {
  valid: boolean;
  findings: ArchitectureFinding[];
};

export type CostMultiplier = {
  code: string;
  label: string;
  value: number;
};

export type ComponentCostEstimate = {
  componentId: string;
  componentName: string;
  kind: string;
  baseMonthlyCost: number;
  multipliers: CostMultiplier[];
  estimatedMonthlyCost: number;
  explanation: string;
};

export type CostEstimate = {
  label: 'Estimated architecture cost';
  currency: 'USD';
  period: 'month';
  totalEstimatedMonthlyCost: number;
  components: ComponentCostEstimate[];
  assumptions: string[];
  disclaimer: string;
  findings: ArchitectureFinding[];
};

export type ScoreAdjustment = {
  code: string;
  delta: number;
  reason: string;
  componentId?: string;
  edgeId?: string;
};

export type ScoreAnalysis = {
  /** Empty architectures are not assessed; null is not a zero score. */
  score: number | null;
  baseScore: number | null;
  adjustments: ScoreAdjustment[];
  findings: ArchitectureFinding[];
};

export type ConstraintStatus = 'met' | 'not-met' | 'not-applicable';

export type ConstraintResult = {
  id:
    | 'cost-budget'
    | 'resilience-target'
    | 'security-target'
    | 'required-region'
    | 'multi-az-required'
    | 'encryption-at-rest-required';
  status: ConstraintStatus;
  actual: JsonValue;
  expected: JsonValue;
  message: string;
};

export type ConstraintEvaluation = {
  withinBudget: boolean | null;
  allApplicableConstraintsMet: boolean;
  results: ConstraintResult[];
};

export type AnalysisFocus =
  'all' | 'cost' | 'resilience' | 'security' | 'validation';

export type AnalyzeArchitectureOptions = {
  focus?: AnalysisFocus;
};

export type ArchitectureAnalysis = {
  architectureId: string;
  architectureRevision: number;
  focus: AnalysisFocus;
  estimatedMonthlyCost: number;
  resilienceScore: number | null;
  securityScore: number | null;
  validationStatus: 'valid' | 'invalid';
  cost: CostEstimate;
  resilience: ScoreAnalysis;
  security: ScoreAnalysis;
  validation: ValidationAnalysis;
  constraints: ConstraintEvaluation;
  findings: ArchitectureFinding[];
};

export type ArchitectureAnalyzer = (
  architecture: Architecture,
  options?: AnalyzeArchitectureOptions,
) => ArchitectureAnalysis;
