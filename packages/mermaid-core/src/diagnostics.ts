import type { DiagramDiagnostic } from "./types.js"

export function toDiagnostic(error: unknown, severity: DiagramDiagnostic["severity"]): DiagramDiagnostic {
  const message = error instanceof Error ? error.message : String(error)
  const position = parseLineColumn(message)
  return {
    severity,
    message,
    ...position,
  }
}

export function buildRuntimeFailureMessage(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error)
  return [
    message,
    "diagram Mermaid runtime is not ready.",
    "The installed plugin runtime may be missing, outdated, or incomplete.",
    "Update or reinstall the `diagram` plugin, then try again.",
  ].join(" ")
}

export function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;")
}

function parseLineColumn(message: string): Pick<DiagramDiagnostic, "line" | "column"> | undefined {
  const match = message.match(/line\s+(\d+)(?:.*column\s+(\d+))?/i)
  if (!match) {
    return undefined
  }

  return {
    line: Number(match[1]),
    column: match[2] ? Number(match[2]) : undefined,
  }
}
