#!/usr/bin/env node
import { access } from "node:fs/promises"
import path from "node:path"
import { fileURLToPath, pathToFileURL } from "node:url"

const currentDir = path.dirname(fileURLToPath(import.meta.url))
const runtimeMermaidCorePath = path.resolve(currentDir, "../../../runtime/mermaid-core/dist/index.js")
const panelWidth = 120
const innerWidth = panelWidth - 4
const labelWidth = 15

let resultWritten = false

async function main() {
  if (process.argv.length > 2) {
    writeResult(
      buildErrorResult("diagram draw CLI reads one JSON object from stdin and does not accept arguments.")
    )
    return
  }

  const mermaidCore = await loadMermaidCore()
  const runtimeStatus = await mermaidCore.checkMermaidRuntime()

  if (!runtimeStatus.ok) {
    writeResult(buildErrorResult(runtimeStatus.message || "diagram Mermaid runtime is not ready."))
    process.exitCode = 1
    return
  }

  const inputText = await readStdin()
  const input = parseInput(inputText)

  if (!input.ok) {
    writeResult(buildErrorResult(input.message))
    return
  }

  const validationResult = await mermaidCore.validateMermaid(input.value.source)
  if (!validationResult.ok) {
    writeResult({
      ...validationResult,
      displayText: summarizeRenderResult(validationResult),
    })
    return
  }

  const renderResult = await mermaidCore.renderMermaid({
    source: input.value.source,
    format: input.value.format,
    exportPng: input.value.format === "png" || input.value.includePng !== false,
    title: input.value.title,
    theme: input.value.theme,
    outputDir: input.value.outputDir,
    renderId: input.value.renderId,
  })

  writeResult({
    ...renderResult,
    displayText: summarizeRenderResult(renderResult),
  })
}

async function loadMermaidCore() {
  try {
    await access(runtimeMermaidCorePath)
    return await import(pathToFileURL(runtimeMermaidCorePath).href)
  } catch {
    const message = `Missing packaged diagram Mermaid runtime at: ${runtimeMermaidCorePath}`
    console.error("[diagram/draw] missing packaged runtime payload")
    console.error(message)
    console.error("Rebuild and republish the plugin with plugins/runtime included.")
    writeResult(buildErrorResult(message))
    process.exitCode = 1
    throw new Error(message)
  }
}

async function readStdin() {
  const chunks = []
  for await (const chunk of process.stdin) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk))
  }
  return Buffer.concat(chunks).toString("utf8")
}

function parseInput(inputText) {
  let parsed
  try {
    parsed = JSON.parse(inputText)
  } catch {
    return { ok: false, message: "diagram draw input must be a JSON object." }
  }

  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    return { ok: false, message: "diagram draw input must be a JSON object." }
  }

  if (typeof parsed.source !== "string" || parsed.source.length === 0) {
    return { ok: false, message: "diagram draw input must include a non-empty source string." }
  }

  if (parsed.format !== undefined && !["svg", "png", "html"].includes(parsed.format)) {
    return { ok: false, message: "diagram draw format must be svg, png, or html." }
  }

  if (parsed.includePng !== undefined && typeof parsed.includePng !== "boolean") {
    return { ok: false, message: "diagram draw includePng must be a boolean when provided." }
  }

  if (parsed.title !== undefined && typeof parsed.title !== "string") {
    return { ok: false, message: "diagram draw title must be a string when provided." }
  }

  if (parsed.theme !== undefined && !["default", "neutral", "dark", "forest"].includes(parsed.theme)) {
    return { ok: false, message: "diagram draw theme must be default, neutral, dark, or forest." }
  }

  if (parsed.outputDir !== undefined && typeof parsed.outputDir !== "string") {
    return { ok: false, message: "diagram draw outputDir must be a string when provided." }
  }

  if (parsed.renderId !== undefined && typeof parsed.renderId !== "string") {
    return { ok: false, message: "diagram draw renderId must be a string when provided." }
  }

  return {
    ok: true,
    value: {
      source: parsed.source,
      format: parsed.format,
      includePng: parsed.includePng,
      title: parsed.title,
      theme: parsed.theme,
      outputDir: parsed.outputDir,
      renderId: parsed.renderId,
    },
  }
}

function buildErrorResult(message) {
  const result = {
    ok: false,
    diagramType: null,
    diagnostics: [
      {
        severity: "error",
        message,
      },
    ],
  }

  return {
    ...result,
    displayText: summarizeRenderResult(result),
  }
}

function summarizeRenderResult(result) {
  if (!result.ok) {
    return appendDiagnostics(
      renderPanel("diagram draw", [
        ...renderKeyValue("Status", "ERROR"),
        ...renderKeyValue("Diagram Type", result.diagramType ?? "unknown"),
      ]),
      result.diagnostics
    )
  }

  return appendDiagnostics(
    renderPanel("diagram draw", [
      ...renderKeyValue("Status", "OK"),
      ...renderKeyValue("Diagram Type", result.diagramType ?? "unknown"),
      "",
      "Resources",
      ...renderKeyValue("HTML Path", result.htmlPath ?? "n/a"),
      ...renderKeyValue("SVG Path", result.svgPath ?? "n/a"),
      ...renderKeyValue("PNG Path", result.pngPath ?? "n/a"),
    ]),
    result.diagnostics
  )
}

function appendDiagnostics(displayText, diagnostics) {
  if (diagnostics.length === 0) {
    return displayText
  }

  return `${displayText}\n\nDiagnostics:\n${summarizeDiagnostics(diagnostics)
    .map((line) => `- ${line}`)
    .join("\n")}`
}

function summarizeDiagnostics(diagnostics) {
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

function renderPanel(title, bodyLines) {
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

function renderKeyValue(label, value) {
  const wrappedValue = wrapText(value, innerWidth - labelWidth)

  return wrappedValue.map((line, index) => {
    const prefix = index === 0 ? `${label}:`.padEnd(labelWidth, " ") : " ".repeat(labelWidth)
    return `${prefix}${line}`
  })
}

function formatPanelLine(content) {
  return `| ${content.slice(0, innerWidth).padEnd(innerWidth, " ")} |`
}

function wrapText(text, width) {
  if (text.length === 0) {
    return [""]
  }

  const normalized = text.replace(/\r\n/g, "\n")
  const wrappedLines = []

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

function findPreferredBreak(segment) {
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

function writeResult(result) {
  resultWritten = true
  process.stdout.write(`${JSON.stringify(result)}\n`)
}

main().catch((error) => {
  if (resultWritten) {
    return
  }

  const message = error instanceof Error ? error.message : "diagram draw CLI failed."
  console.error("[diagram/draw] failed to run diagram draw CLI")
  console.error(error)
  writeResult(buildErrorResult(message))
  process.exitCode = 1
})
