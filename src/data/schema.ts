import { z } from 'zod';

/**
 * Zod schemas for the two JSON datasets. Shared by the integrity tests and by
 * scripts/research/update.mjs, which validates every file it writes.
 */
export const ISO_DATE = /^\d{4}-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/;
export const ISO3 = /^[A-Z]{3}$/;

export const SourceSchema = z.object({
  name: z.string().min(2),
  url: z.string().url().startsWith('https://'),
});

export const IntensitySchema = z.enum(['high', 'medium', 'low', 'latent']);
export const ConfidenceSchema = z.enum(['high', 'medium', 'low']);

export const HistoryEntrySchema = z.object({
  date: z.string().regex(ISO_DATE),
  intensity: IntensitySchema,
  status: z.string().min(40).max(700),
  sources: z.array(SourceSchema).min(1).max(5),
  confidence: ConfidenceSchema.optional(),
});

export const ConflictInputSchema = z.object({
  id: z.string().regex(/^[a-z0-9-]+$/),
  name: z.string().min(3),
  type: z.enum(['interstate', 'civil-war', 'insurgency', 'asymmetric', 'criminal-violence', 'flashpoint']),
  since: z.number().int().min(1900).max(2100),
  location: z.tuple([z.number().min(-180).max(180), z.number().min(-90).max(90)]),
  countries: z.array(z.string().regex(ISO3)).min(1),
  parties: z.array(z.string().min(2)).min(1),
  summary: z.string().min(40),
  history: z.array(HistoryEntrySchema).min(1),
  lastChecked: z.string().regex(ISO_DATE).optional(),
});

export const BlocMemberSchema = z.object({
  iso: z.string().regex(ISO3),
  status: z.enum(['member', 'suspended', 'frozen', 'partner', 'observer', 'invited']),
  note: z.string().optional(),
});

export const BlocChangeSchema = z.object({
  date: z.string().regex(ISO_DATE),
  iso: z.string().regex(ISO3),
  change: z.enum(['joined', 'left', 'suspended', 'reinstated', 'frozen', 'invited', 'founded']),
  note: z.string().optional(),
  source: SourceSchema.optional(),
});

export const BlocSchema = z.object({
  id: z.string().regex(/^[a-z0-9-]+$/),
  name: z.string().min(2),
  shortName: z.string().min(1),
  category: z.enum(['security', 'economic', 'political', 'regional']),
  color: z.string().regex(/^#[0-9a-f]{6}$/i),
  founded: z.number().int(),
  headquarters: z.string().optional(),
  description: z.string().min(20),
  members: z.array(BlocMemberSchema).min(1),
  sources: z.array(SourceSchema).min(1),
  updated: z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/),
  changes: z.array(BlocChangeSchema),
});

export const ConflictsFileSchema = z.array(ConflictInputSchema);
export const BlocsFileSchema = z.array(BlocSchema);

/** What the research model returns for one conflict. Kept flat and enum-only so it compiles as a structured-output schema. */
export const AssessmentOutputSchema = z.object({
  changed: z.boolean().describe('true only if there is a material development since the previous assessment'),
  intensity: IntensitySchema,
  status: z.string().describe('2-3 factual, dated sentences, 150-600 characters, covering developments up to today'),
  sources: z.array(z.object({ name: z.string(), url: z.string() })).describe('1-3 specific articles or tracker pages found in the search results'),
  confidence: ConfidenceSchema,
  note: z.string().describe('one line for the reviewer: anything surprising, disputed or worth a human look; empty string if none'),
});

export const BlocReviewOutputSchema = z.object({
  changes: z.array(
    z.object({
      blocId: z.string(),
      iso: z.string().describe('ISO 3166-1 alpha-3'),
      change: z.enum(['joined', 'left', 'suspended', 'reinstated', 'frozen', 'invited', 'founded']),
      date: z.string().describe('YYYY-MM-DD the change took effect'),
      note: z.string(),
      source: z.object({ name: z.string(), url: z.string() }),
    }),
  ),
  note: z.string(),
});

export const NewConflictsOutputSchema = z.object({
  candidates: z.array(
    z.object({
      name: z.string(),
      countries: z.array(z.string()),
      type: z.enum(['interstate', 'civil-war', 'insurgency', 'asymmetric', 'criminal-violence', 'flashpoint']),
      intensity: IntensitySchema,
      why: z.string().describe('one or two sentences on why this belongs on the map'),
      source: z.object({ name: z.string(), url: z.string() }),
    }),
  ),
});

// ---------------------------------------------------------------------------
// Batch 2 datasets: sanctions (generated), elections (research-maintained), nuclear (curated).

export const SanctionsAuthoritySchema = z.enum(['UN', 'US', 'EU']);

export const SanctionsRegimeSchema = z.object({
  authority: SanctionsAuthoritySchema,
  name: z.string().min(3),
  url: z.string().url().startsWith('https://'),
});

export const SanctionsFileSchema = z.object({
  sources: z.array(SourceSchema).min(1),
  fetchedAt: z.string().regex(ISO_DATE),
  /** OFAC programme slugs the build script could not map to a country; for a human to review. */
  unmapped: z.array(z.string()),
  /** Countries the EU map flags as under UN measures that the curated UN list lacks. */
  unReview: z.array(z.string().regex(ISO3)),
  rows: z.array(z.object({ iso: z.string().regex(ISO3), regimes: z.array(SanctionsRegimeSchema).min(1) })),
});

/** YYYY, YYYY-MM or YYYY-MM-DD: elections are often known only to the month or year. */
export const PARTIAL_DATE = /^\d{4}(-(0[1-9]|1[0-2])(-(0[1-9]|[12]\d|3[01]))?)?$/;

export const ElectionTypeSchema = z.enum(['general', 'legislative', 'presidential']);

export const ElectionSchema = z.object({
  iso: z.string().regex(ISO3),
  /** Next national election, or null when none is scheduled (suspended, postponed indefinitely). */
  date: z.string().regex(PARTIAL_DATE).nullable(),
  type: ElectionTypeSchema,
  /** True when `date` is the constitutional deadline rather than a fixed date. */
  deadline: z.boolean().optional(),
  note: z.string().max(200).optional(),
  sources: z.array(SourceSchema).min(1).max(4),
  /** Date the entry was last checked, YYYY-MM-DD. */
  verified: z.string().regex(ISO_DATE),
});

export const ElectionsFileSchema = z.object({
  source: SourceSchema,
  rows: z.array(ElectionSchema),
});

export const NuclearStatusSchema = z.enum(['armed', 'threshold', 'hosting', 'umbrella']);

export const NuclearFileSchema = z.object({
  verified: z.string().regex(ISO_DATE),
  sources: z.array(SourceSchema).min(1),
  statuses: z.array(
    z.object({
      iso: z.string().regex(ISO3),
      status: NuclearStatusSchema,
      note: z.string().min(10).max(400),
      sources: z.array(SourceSchema).min(1),
    }),
  ),
  /** Every full member of this bloc without its own status is under its nuclear umbrella. */
  umbrellaBloc: z.string().regex(/^[a-z0-9-]+$/),
  tests: z.array(z.object({ iso: z.string().regex(ISO3), date: z.string().regex(ISO_DATE), note: z.string().min(3), source: SourceSchema })),
});

/** What the research model returns when asked for a country's next national election. */
export const ElectionOutputSchema = z.object({
  known: z.boolean().describe('false if no date has been set or announced'),
  date: z.string().describe('YYYY-MM-DD, or YYYY-MM when only the month is known, or YYYY; empty string if unknown'),
  deadline: z.boolean().describe('true if the date is a legal deadline rather than a scheduled date'),
  type: ElectionTypeSchema,
  note: z.string().describe('one short line of context, e.g. "Second round", "Postponed from May 2026"; empty if none'),
  source: z.object({ name: z.string(), url: z.string() }).describe('the page in the search results that states the date'),
});
