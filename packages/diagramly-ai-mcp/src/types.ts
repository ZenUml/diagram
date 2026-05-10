export const toolNames = [
  "create_diagramly_diagram",
  "start_diagramly_auth",
  "complete_diagramly_auth",
] as const

export type ToolName = (typeof toolNames)[number]

export interface DiagramDiagnostic {
  severity: "error" | "warning" | "info"
  message: string
  line?: number
  column?: number
}

export interface DiagramlyInfo {
  provider: "diagramly.ai"
  status: "created" | "authorization_required" | "authorization_pending" | "authorized" | "error"
  loginUrl?: string
  userCode?: string
  expiresAt?: string
  diagramId?: string
  versionId?: string
  tokenCachePath?: string
  httpStatus?: number
  error?: string
}

export interface CreateDiagramlyDiagramToolInput {
  source: string
  title?: string
  diagramType?: string | null
  renderId?: string
  svgPath?: string
  pngPath?: string
  htmlPath?: string
}

export type StartDiagramlyAuthToolInput = Record<string, never>

export interface DiagramlyDiagramToolResult {
  ok: boolean
  diagramType: string | null
  diagnostics: DiagramDiagnostic[]
  renderId?: string
  svgPath?: string
  pngPath?: string
  htmlPath?: string
  previewId?: string
  previewUrl?: string
  diagramly: DiagramlyInfo
}

export interface CompleteDiagramlyAuthToolInput {
  waitSeconds?: number
}

export interface ToolDescriptor {
  name: ToolName
  description: string
}

export type ToolInputMap = {
  create_diagramly_diagram: CreateDiagramlyDiagramToolInput
  start_diagramly_auth: StartDiagramlyAuthToolInput
  complete_diagramly_auth: CompleteDiagramlyAuthToolInput
}

export type ToolResultMap = {
  create_diagramly_diagram: DiagramlyDiagramToolResult
  start_diagramly_auth: DiagramlyDiagramToolResult
  complete_diagramly_auth: DiagramlyDiagramToolResult
}
