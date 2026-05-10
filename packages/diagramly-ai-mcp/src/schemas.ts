import * as z from "zod/v4"

export const diagnosticSchema = z.object({
  severity: z.enum(["error", "warning", "info"]),
  message: z.string(),
  line: z.number().optional(),
  column: z.number().optional(),
})

export const createDiagramlyDiagramInputSchema = z.object({
  source: z.string().min(1).describe("Diagram source text to publish to Diagramly.ai."),
  title: z.string().optional().describe("Optional Diagramly.ai diagram title."),
  diagramType: z
    .string()
    .nullable()
    .optional()
    .describe("Optional diagram type. Inferred from source when omitted."),
  renderId: z.string().optional().describe("Optional local render identifier to carry through."),
  svgPath: z.string().optional().describe("Optional local SVG path to carry through."),
  pngPath: z.string().optional().describe("Optional local PNG path to carry through."),
  htmlPath: z.string().optional().describe("Optional local HTML path to carry through."),
})

export const completeDiagramlyAuthInputSchema = z.object({
  waitSeconds: z
    .number()
    .int()
    .min(0)
    .max(115)
    .optional()
    .describe("Maximum seconds to wait for the current pending Diagramly.ai authorization. Defaults to 110."),
})

export const startDiagramlyAuthInputSchema = z.object({})

export const diagramlyDiagramToolOutputSchema = z.object({
  ok: z.boolean(),
  diagramType: z.string().nullable(),
  renderId: z.string().optional(),
  displayText: z.string().optional(),
  previewId: z.string().optional(),
  previewUrl: z.string().optional(),
  diagramly: z.object({
    provider: z.literal("diagramly.ai"),
    status: z.enum(["created", "authorization_required", "authorization_pending", "authorized", "error"]),
    loginUrl: z.string().optional(),
    userCode: z.string().optional(),
    expiresAt: z.string().optional(),
    diagramId: z.string().optional(),
    versionId: z.string().optional(),
    tokenCachePath: z.string().optional(),
    httpStatus: z.number().optional(),
    error: z.string().optional(),
  }),
  svgPath: z.string().optional(),
  pngPath: z.string().optional(),
  htmlPath: z.string().optional(),
  diagnostics: z.array(diagnosticSchema),
})
