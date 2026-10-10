import { z } from 'zod';

export const EvidenceItemSchema = z.object({
  startLine: z.number().int().nonnegative(),
  endLine: z.number().int().nonnegative(),
  quote: z.string().max(250),
  permalink: z.string().default(''),
});

export const RelevantFileSchema = z.object({
  path: z.string(),
  reason: z.string(),
  confidence: z.enum(['high', 'medium', 'low']),
  evidence: z.array(EvidenceItemSchema).default([]),
  verified: z.boolean().default(true),
});

export const CodeFlowStepSchema = z.object({
  step: z.string(),
  path: z.string().default(''),
  startLine: z.number().int().nullable().default(null),
  endLine: z.number().int().nullable().default(null),
  verified: z.boolean().default(true),
});

export const ConventionsSchema = z.object({
  installCommand: z.string().nullable().default(null),
  testCommand: z.string().nullable().default(null),
  lintCommand: z.string().nullable().default(null),
  commitStyle: z.string().nullable().default(null),
  sources: z.array(z.string()).default([]),
});

export const IssueAnalysisSchema = z.object({
  summary: z.string(),
  expectedBehavior: z.string().nullable().default(null),
  actualBehavior: z.string().nullable().default(null),
  missingInformation: z.array(z.string()).default([]),
});

export const TestingChecklistSchema = z.object({
  existingTestsToInspect: z.array(z.string()).default([]),
  edgeCases: z.array(z.string()).default([]),
  regressionIdeas: z.array(z.string()).default([]),
  commandsToTry: z.array(z.string()).default([]),
});

export const ContributionFitSchema = z.object({
  level: z.enum(['easy', 'medium', 'hard']),
  effortEstimate: z.string().optional().default('1–2 hours'),
  reasons: z.array(z.string()).default([]),
});

export const PrKitSchema = z.object({
  branchName: z.string().default(''),
  commitMessage: z.string().default(''),
  prDescriptionDraft: z.string().default(''),
  disclaimer: z.string().default('DRAFT — edit before using'),
});

export const GlossaryItemSchema = z.object({
  term: z.string(),
  definition: z.string(),
});

export const HonestySchema = z.object({
  verifiedFacts: z.array(z.string()).default([]),
  hypotheses: z.array(z.string()).default([]),
  missingContext: z.array(z.string()).default([]),
  limitations: z.array(z.string()).default([]),
});

export const DiagnosticsSchema = z.object({
  filesFetched: z.number().int().default(0),
  filesCited: z.number().int().default(0),
  citationsDropped: z.number().int().default(0),
  truncated: z.boolean().default(false),
  timingMs: z.number().int().default(0),
});

export const RepositorySchema = z.object({
  owner: z.string(),
  name: z.string(),
  description: z.string().default(''),
  primaryLanguage: z.string().default(''),
  defaultBranch: z.string().default('main'),
  commitSha: z.string().default(''),
  stars: z.number().int().nonnegative().optional().default(0),
  technologies: z.array(z.string()).default([]),
  entryPoints: z.array(z.string()).default([]),
});

export const AnalyzeResponseSchema = z.object({
  mode: z.enum(['live', 'sample']),
  repository: RepositorySchema,
  conventions: ConventionsSchema,
  issueAnalysis: IssueAnalysisSchema,
  relevantFiles: z.array(RelevantFileSchema),
  codeFlow: z.array(CodeFlowStepSchema),
  investigationPlan: z.array(z.string()),
  testingChecklist: TestingChecklistSchema,
  contributionFit: ContributionFitSchema,
  prKit: PrKitSchema,
  glossary: z.array(GlossaryItemSchema).default([]),
  honesty: HonestySchema,
  diagnostics: DiagnosticsSchema,
});

export type AnalyzeResponse = z.infer<typeof AnalyzeResponseSchema>;
export type RelevantFile = z.infer<typeof RelevantFileSchema>;
export type CodeFlowStep = z.infer<typeof CodeFlowStepSchema>;
export type EvidenceItem = z.infer<typeof EvidenceItemSchema>;

export const AnalyzeRequestSchema = z.object({
  repositoryUrl: z.string().min(1, 'Repository URL is required'),
  issue: z.object({
    title: z.string().optional().default(''),
    description: z.string().min(1, 'Issue description is required').max(8000),
    url: z.string().optional().default(''),
  }),
  beginnerMode: z.boolean().optional().default(false),
});

export type AnalyzeRequest = z.infer<typeof AnalyzeRequestSchema>;
