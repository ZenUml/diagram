import { mkdir, readFile, realpath, writeFile } from "node:fs/promises"
import path from "node:path"

import { DEFAULT_OUTPUT_ROOT } from "./constants.js"
import { toDiagnostic } from "./diagnostics.js"
import { inferDiagramType } from "./diagram-type.js"
import { createRenderId } from "./id.js"
import { buildHtmlDocument } from "./html.js"
import { buildRenderCacheKey, tryReuseRenderCache, writeRenderCacheMetadata } from "./render-cache.js"
import { resolveRendererPath, runRenderer } from "./runtime.js"
import { getRootSvgDimensions, normalizeSvg } from "./svg.js"
import type { RenderRequest, RenderResult } from "./types.js"

export async function renderMermaid(request: RenderRequest): Promise<RenderResult> {
  const diagramType = inferDiagramType(request.source)
  const renderId = request.renderId || createRenderId()
  const requestedOutputDir = path.resolve(request.outputDir || path.join(DEFAULT_OUTPUT_ROOT, renderId))
  await mkdir(requestedOutputDir, { recursive: true })
  const outputDir = await realpath(requestedOutputDir)

  const sourcePath = path.join(outputDir, "diagram.mmd")
  await writeFile(sourcePath, request.source, "utf8")

  const svgPath = path.join(outputDir, "diagram.svg")
  const pngPath = request.exportPng ? path.join(outputDir, "diagram.png") : undefined
  const htmlPath = path.join(outputDir, "index.html")
  const cachePath = path.join(outputDir, ".diagramly-render-cache.json")
  const cacheKey = buildRenderCacheKey(request)
  const rendererPath = await resolveRendererPath()

  try {
    const cachedResult = await tryReuseRenderCache({
      cachePath,
      cacheKey,
      svgPath,
      pngPath,
      htmlPath,
    })
    if (cachedResult) {
      return {
        ok: true,
        diagramType,
        renderId,
        ...cachedResult,
        previewUrl: undefined,
        diagnostics: [],
      }
    }

    await runRenderer({
      rendererPath,
      inputPath: sourcePath,
      outputPath: svgPath,
      theme: request.theme,
    })

    const rawSvg = await readFile(svgPath, "utf8")
    const normalizedSvg = await normalizeSvg(rawSvg, {
      title: request.title,
      diagramType,
    })
    await writeFile(svgPath, normalizedSvg, "utf8")

    if (pngPath) {
      const rootDimensions = getRootSvgDimensions(normalizedSvg)
      await runRenderer({
        rendererPath,
        inputPath: sourcePath,
        outputPath: pngPath,
        theme: request.theme,
        width: diagramType === "zenuml" && rootDimensions.width ? rootDimensions.width + 16 : undefined,
      })
    }

    let finalHtmlPath = htmlPath
    if (finalHtmlPath) {
      await writeFile(
        finalHtmlPath,
        buildHtmlDocument(normalizedSvg, request, {
          hasPng: Boolean(pngPath),
        }),
        "utf8"
      )
    }

    await writeRenderCacheMetadata(cachePath, {
      cacheKey,
      svgPath,
      pngPath,
      htmlPath: finalHtmlPath,
    })

    return {
      ok: true,
      diagramType,
      renderId,
      svgPath,
      pngPath,
      htmlPath: finalHtmlPath,
      previewUrl: undefined,
      diagnostics: [],
    }
  } catch (error) {
    return {
      ok: false,
      diagramType,
      renderId,
      svgPath: undefined,
      pngPath: undefined,
      htmlPath: undefined,
      previewUrl: undefined,
      diagnostics: [toDiagnostic(error, "error")],
    }
  }
}
