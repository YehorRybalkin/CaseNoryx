/**
 * Public (client-safe) case model. Nothing in this file or in a case's public
 * definition may contain answer keys — those live in src/server/answer-keys.
 */
export type Difficulty = "Beginner" | "Intermediate" | "Advanced";
export type CaseSlug = "retail-profitability" | "saas-churn" | "airline-route" | "ecommerce-marketing" | "manufacturing-ops";

export type ColumnType = "string" | "month" | "integer" | "number" | "currency" | "percent" | "ratio";
export type CellValue = string | number | null;
export type Row = Record<string, CellValue>;

export interface ColumnDef {
  key: string;
  label: string;
  type: ColumnType;
  description: string;
  /** Display unit, e.g. "EUR", "units", "hours". Percent columns store fractions. */
  unit?: string;
}

export interface DatasetDef {
  id: string;
  name: string;
  description: string;
  columns: ColumnDef[];
  rows: Row[];
  /** Column holding the period (YYYY-MM) used by time filters. */
  timeKey?: string;
  /** Categorical columns offered for segmentation filters. */
  segmentKeys?: string[];
}

export type ValueFormat = "currency" | "currencyM" | "percent" | "number" | "integer" | "ratio" | "months";

export interface ScenarioLever {
  id: string;
  label: string;
  description: string;
  min: number;
  max: number;
  step: number;
  defaultValue: number;
  /** Display suffix for the lever value. */
  unit: string;
}

export interface ScenarioMetric {
  id: string;
  label: string;
  format: ValueFormat;
  higherIsBetter: boolean;
  description?: string;
}

export interface ScenarioResult {
  baseline: Record<string, number | null>;
  scenario: Record<string, number | null>;
  /** Plain-language notes describing assumptions used in the calculation. */
  notes: string[];
}

export interface QuantQuestion {
  id: string;
  prompt: string;
  /** Unit the user must answer in, shown next to the input. */
  unit: "%" | "pp" | "EUR" | "EUR m" | "x" | "months" | "units" | "EUR per unit";
  hint?: string;
}

export interface DiagnosisOption {
  id: string;
  label: string;
}

export interface CaseBrief {
  clientIntro: string;
  context: string[];
  problem: string;
  objectives: string[];
  successCriteria: string[];
  stakeholders: { name: string; role: string; quote: string }[];
}

export interface CaseDefinition {
  slug: CaseSlug;
  title: string;
  client: string;
  industry: string;
  difficulty: Difficulty;
  estimatedMinutes: number;
  summary: string;
  tags: string[];
  brief: CaseBrief;
  kpis: { label: string; definition: string }[];
  investigationQuestions: string[];
  learningOutcomes: string[];
  datasets: DatasetDef[];
  scenario: { levers: ScenarioLever[]; metrics: ScenarioMetric[] };
  quantQuestions: QuantQuestion[];
  diagnosisOptions: DiagnosisOption[];
  /** Explicit assumptions the user may rely on (e.g. LTV method). */
  assumptions: string[];
}

export type CaseSummary = Pick<
  CaseDefinition,
  "slug" | "title" | "client" | "industry" | "difficulty" | "estimatedMinutes" | "summary" | "tags"
>;
