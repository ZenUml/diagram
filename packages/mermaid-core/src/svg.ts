import { readFile } from "node:fs/promises"

import { escapeHtml } from "./diagnostics.js"
import { resolveLocalModulePath } from "./module-resolution.js"

let zenumlEmbeddedCssCache: string | null | undefined

export type SvgDimensions = {
  width?: number
  height?: number
}

export async function normalizeSvg(
  svg: string,
  options: { title?: string; diagramType?: string | null }
): Promise<string> {
  let normalizedSvg = normalizeRootSvgDimensions(svg)

  if (options.title && !normalizedSvg.includes("<title>")) {
    normalizedSvg = normalizedSvg.replace(
      /<svg([^>]*)>/,
      `<svg$1><title>${escapeHtml(options.title)}</title>`
    )
  }

  if (options.diagramType === "zenuml" && normalizedSvg.includes("<foreignObject")) {
    normalizedSvg = await inlineZenumlStyles(normalizedSvg)
    normalizedSvg = normalizeZenumlRootSize(normalizedSvg)
  }

  return normalizedSvg
}

export function getRootSvgDimensions(svg: string): SvgDimensions {
  const rootMatch = svg.match(/<svg([^>]*)>/)
  if (!rootMatch) {
    return {}
  }

  return {
    width: extractNumericAttribute(rootMatch[1], "width"),
    height: extractNumericAttribute(rootMatch[1], "height"),
  }
}

export function getZenumlContentWidth(svg: string): number | undefined {
  if (!svg.includes("zenuml") || !svg.includes("<foreignObject")) {
    return undefined
  }

  let contentWidth = 0
  const styleAttributePattern = /\sstyle="([^"]*)"/g
  let styleMatch = styleAttributePattern.exec(svg)

  while (styleMatch !== null) {
    const width = extractStylePx(styleMatch[1], "width")
    if (width) {
      contentWidth = Math.max(contentWidth, Number(width))
    }
    styleMatch = styleAttributePattern.exec(svg)
  }

  return contentWidth > 0 ? Math.ceil(contentWidth) : undefined
}

function normalizeRootSvgDimensions(svg: string): string {
  return svg.replace(/<svg([^>]*)>/, (_match, rawAttributes: string) => {
    let attributes = rawAttributes
    const styleMatch = attributes.match(/\sstyle="([^"]*)"/)
    if (!styleMatch) {
      return `<svg${attributes}>`
    }

    const styleValue = styleMatch[1]
    const widthPx = extractStylePx(styleValue, "width")
    const heightPx = extractStylePx(styleValue, "height")
    const cleanedStyle = removeStyleProperties(styleValue, ["width", "height"])

    if (widthPx) {
      attributes = upsertAttribute(attributes, "width", widthPx)
    }

    if (heightPx) {
      attributes = upsertAttribute(attributes, "height", heightPx)
    }

    if (cleanedStyle) {
      attributes = attributes.replace(styleMatch[0], ` style="${cleanedStyle}"`)
    } else {
      attributes = attributes.replace(styleMatch[0], "")
    }

    return `<svg${attributes}>`
  })
}

function normalizeZenumlRootSize(svg: string): string {
  const contentWidth = getZenumlContentWidth(svg)
  if (!contentWidth) {
    return svg
  }

  const exportWidth = contentWidth + 36

  return svg.replace(/<svg([^>]*)>/, (match, rawAttributes: string) => {
    const rootWidth = extractNumericAttribute(rawAttributes, "width")
    if (rootWidth && rootWidth >= exportWidth) {
      return match
    }

    const attributes = upsertAttribute(rawAttributes, "width", String(exportWidth))
    return `<svg${attributes}>`
  })
}

function extractNumericAttribute(attributes: string, name: string): number | undefined {
  const pattern = new RegExp(`\\s${name}="([0-9]+(?:\\.[0-9]+)?)"`)
  const match = pattern.exec(attributes)
  return match ? Number(match[1]) : undefined
}

function extractStylePx(styleValue: string, property: string): string | undefined {
  const match = new RegExp(`${property}\\s*:\\s*([0-9]+(?:\\.[0-9]+)?)px`, "i").exec(styleValue)
  return match?.[1]
}

function removeStyleProperties(styleValue: string, properties: string[]): string {
  const cleaned = styleValue
    .split(";")
    .map((part) => part.trim())
    .filter(Boolean)
    .filter((part) => !properties.some((property) => part.toLowerCase().startsWith(`${property}:`)))
    .join("; ")

  return cleaned
}

function upsertAttribute(attributes: string, name: string, value: string): string {
  const pattern = new RegExp(`\\s${name}="[^"]*"`)
  if (pattern.test(attributes)) {
    return attributes.replace(pattern, ` ${name}="${value}"`)
  }

  return `${attributes} ${name}="${value}"`
}

async function inlineZenumlStyles(svg: string): Promise<string> {
  const css = await getZenumlEmbeddedCss()
  if (!css || svg.includes("data-diagramly-zenuml-css")) {
    return svg
  }

  const cssCdata = wrapSvgCdata(css)
  const foreignObjectStyleTag = `<style xmlns="http://www.w3.org/1999/xhtml" data-diagramly-zenuml-css="true">${cssCdata}</style>`

  let normalizedSvg = svg
  if (normalizedSvg.includes("</style>")) {
    normalizedSvg = normalizedSvg.replace(
      /<style>([\s\S]*?)<\/style>/,
      `<style>${wrapSvgCdata(`$1\n${css}`)}</style>`
    )
  } else {
    normalizedSvg = normalizedSvg.replace(/<svg([^>]*)>/, `<svg$1><style>${cssCdata}</style>`)
  }

  return normalizedSvg.replace(/<foreignObject([^>]*)>/, `<foreignObject$1>${foreignObjectStyleTag}`)
}

function wrapSvgCdata(content: string): string {
  return `<![CDATA[${content.replace(/]]>/g, "]]]]><![CDATA[>")}]]>`
}

async function getZenumlEmbeddedCss(): Promise<string | null> {
  if (zenumlEmbeddedCssCache !== undefined) {
    return zenumlEmbeddedCssCache
  }

  for (const relativePath of [
    "vendor/mermaid-zenuml/mermaid-zenuml.min.js",
    "node_modules/@mermaid-js/mermaid-zenuml/dist/mermaid-zenuml.min.js",
    "node_modules/@zenuml/core/dist/zenuml.esm.mjs",
  ]) {
    const css = await tryExtractZenumlInjectedCss(relativePath)
    if (css) {
      zenumlEmbeddedCssCache = css
      return zenumlEmbeddedCssCache
    }
  }

  zenumlEmbeddedCssCache = null
  return null
}

async function tryExtractZenumlInjectedCss(relativePath: string): Promise<string | null> {
  try {
    const bundlePath = await resolveLocalModulePath(relativePath)
    const bundleSource = await readFile(bundlePath, "utf8")
    return extractZenumlInjectedCss(bundleSource)
  } catch {
    return null
  }
}

function extractZenumlInjectedCss(bundleSource: string): string | null {
  const marker = "document.createTextNode("
  let searchStart = 0

  while (searchStart < bundleSource.length) {
    const startIndex = bundleSource.indexOf(marker, searchStart)
    if (startIndex === -1) {
      return null
    }

    const css = extractCreateTextNodeStringArgument(bundleSource, startIndex + marker.length)
    if (css && isZenumlInjectedCss(css)) {
      return css
    }

    searchStart = startIndex + marker.length
  }

  return null
}

function extractCreateTextNodeStringArgument(bundleSource: string, literalStart: number): string | null {
  const quote = bundleSource[literalStart]
  if (quote !== "'" && quote !== '"' && quote !== "`") {
    return null
  }

  let cursor = literalStart
  let escaped = false

  while (cursor + 1 < bundleSource.length) {
    cursor += 1
    const char = bundleSource[cursor]

    if (escaped) {
      escaped = false
      continue
    }

    if (char === "\\") {
      escaped = true
      continue
    }

    if (char === quote) {
      break
    }
  }

  const literal = bundleSource.slice(literalStart, cursor + 1)
  if (!literal.endsWith(quote)) {
    return null
  }

  try {
    return Function(`return ${literal};`)() as string
  } catch {
    return null
  }
}

function isZenumlInjectedCss(css: string): boolean {
  return (
    css.includes("bg-skin-participant") &&
    css.includes("text-skin-message") &&
    css.includes("--color-border-base")
  )
}
