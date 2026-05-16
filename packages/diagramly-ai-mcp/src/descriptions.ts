import type { ToolDescriptor, ToolName } from "./types.js"
import { toolNames } from "./types.js"

const toolDescriptions: Record<ToolName, string> = {
  create_diagramly_diagram:
    "Create a Diagramly.ai online diagram from diagram source after the user asks for or confirms cloud upload. Returns authorization_required with HTTP 403 when no valid token is available.",
  start_diagramly_auth:
    "Start a Diagramly.ai device authorization session and return the authentication URL in diagramly.loginUrl.",
  complete_diagramly_auth:
    "Wait for the pending Diagramly.ai device authorization and cache the token after approval.",
}

export const serverInstructions =
  "Use Diagramly.ai tools only for optional online Diagramly.ai operations after local rendering succeeds. Do not call these tools for local validation or rendering. To publish a diagram online, first confirm the user wants cloud upload, then call create_diagramly_diagram with the diagram source and any local asset paths returned by the draw CLI. If create_diagramly_diagram returns diagramly.status authorization_required, call start_diagramly_auth, surface diagramly.loginUrl exactly as reported, then call complete_diagramly_auth until it returns authorized, expires, errors, or the user asks to stop. After authorization succeeds, call create_diagramly_diagram again with the same diagram source and local asset paths. Diagramly.ai authorization or upload failure must not invalidate the local render."

export function describeTools(): ToolDescriptor[] {
  return toolNames.map((name) => ({
    name,
    description: toolDescriptions[name],
  }))
}

export function getToolDescription(name: ToolName): string {
  return toolDescriptions[name]
}
