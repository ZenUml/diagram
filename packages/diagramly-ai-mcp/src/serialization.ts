import type { DiagramDiagnostic, DiagramlyDiagramToolResult } from "./types.js"

const panelWidth = 120
const innerWidth = panelWidth - 4
const labelWidth = 15

export function summarizeDiagramlyResult(result: DiagramlyDiagramToolResult): string {
  if (!result.ok) {
    return appendDiagnostics(
      renderPanel("Diagramly.ai", [
        ...renderKeyValue("Status", formatRemoteStatus(result)),
        ...renderKeyValue("Diagram Type", result.diagramType ?? "unknown"),
        ...renderKeyValue("HTTP Status", result.diagramly.httpStatus?.toString() ?? "n/a"),
      ]),
      result.diagnostics
    )
  }

  return appendDiagnostics(
    renderPanel("Diagramly.ai", [
      ...renderKeyValue("Status", formatRemoteStatus(result)),
      ...renderKeyValue("Diagram Type", result.diagramType ?? "unknown"),
      "",
      "Resources",
      ...renderKeyValue("Preview URL", result.previewUrl ?? "n/a"),
      ...renderKeyValue("HTML Path", result.htmlPath ?? "n/a"),
      ...renderKeyValue("SVG Path", result.svgPath ?? "n/a"),
      ...renderKeyValue("PNG Path", result.pngPath ?? "n/a"),
    ]),
    result.diagnostics
  )
}

function formatRemoteStatus(result: DiagramlyDiagramToolResult): string {
  switch (result.diagramly.status) {
    case "created":
      return "OK"
    case "authorization_required":
      return "AUTHORIZATION REQUIRED"
    case "authorization_pending":
      return "AUTHORIZATION PENDING"
    case "authorized":
      return "AUTHORIZED"
    case "error":
      return "ERROR"
  }
}

export function toStructuredContent(value: unknown): Record<string, unknown> {
  return JSON.parse(JSON.stringify(value)) as Record<string, unknown>
}

function appendDiagnostics(displayText: string, diagnostics: DiagramDiagnostic[]): string {
  if (diagnostics.length === 0) {
    return displayText
  }

  return `${displayText}\n\nDiagnostics:\n${summarizeDiagnostics(diagnostics)
    .map((line) => `- ${line}`)
    .join("\n")}`
}

function summarizeDiagnostics(diagnostics: DiagramDiagnostic[]): string[] {
  if (diagnostics.length === 0) {
    return []
  }

  return diagnostics
    .map((diagnostic) => {
      const location = diagnostic.line
        ? diagnostic.column
          ? ` line ${diagnostic.line}, col ${diagnostic.column}`
          : ` line ${diagnostic.line}`
        : ""
      return `${diagnostic.severity.toUpperCase()}${location}: ${diagnostic.message}`
    })
    .flatMap((line) => wrapText(line, innerWidth))
}

function renderPanel(title: string, bodyLines: string[]): string {
  const border = `+${"-".repeat(panelWidth - 2)}+`
  const lines = [
    border,
    formatPanelLine(title),
    border,
    ...bodyLines.map((line) => formatPanelLine(line)),
    border,
  ]

  return lines.join("\n")
}

function renderKeyValue(label: string, value: string): string[] {
  const wrappedValue = wrapText(value, innerWidth - labelWidth)

  return wrappedValue.map((line, index) => {
    const prefix = index === 0 ? `${label}:`.padEnd(labelWidth, " ") : " ".repeat(labelWidth)
    return `${prefix}${line}`
  })
}

function formatPanelLine(content: string): string {
  return `| ${content.slice(0, innerWidth).padEnd(innerWidth, " ")} |`
}

function wrapText(text: string, width: number): string[] {
  if (text.length === 0) {
    return [""]
  }

  const normalized = text.replace(/\r\n/g, "\n")
  const wrappedLines: string[] = []

  for (const rawLine of normalized.split("\n")) {
    if (rawLine.length === 0) {
      wrappedLines.push("")
      continue
    }

    let start = 0
    while (start < rawLine.length) {
      const remaining = rawLine.length - start
      if (remaining <= width) {
        wrappedLines.push(rawLine.slice(start))
        break
      }

      const segment = rawLine.slice(start, start + width)
      const preferredBreak = findPreferredBreak(segment)
      const end = preferredBreak > 0 ? start + preferredBreak : start + width

      wrappedLines.push(rawLine.slice(start, end).trimEnd())
      start = end

      while (rawLine[start] === " ") {
        start += 1
      }
    }
  }

  return wrappedLines
}

function findPreferredBreak(segment: string): number {
  const separators = [" ", "/", "\\", "-", "_"]
  let bestIndex = -1

  for (const separator of separators) {
    const index = segment.lastIndexOf(separator)
    if (index > bestIndex) {
      bestIndex = index
    }
  }

  return bestIndex >= Math.floor(segment.length / 3) ? bestIndex + 1 : -1
}
