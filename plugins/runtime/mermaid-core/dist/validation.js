import { createHash } from "node:crypto"
import { mkdir, rm, writeFile } from "node:fs/promises"
import path from "node:path"
import { DEFAULT_OUTPUT_ROOT, VALIDATION_CACHE_LIMIT } from "./constants.js"
import { toDiagnostic } from "./diagnostics.js"
import { inferDiagramType } from "./diagram-type.js"
import { createValidationId } from "./id.js"
import { resolveRendererPath, runRenderer } from "./runtime.js"
const validationCache = new Map()
export async function validateMermaid(source) {
  const diagramType = inferDiagramType(source)
  const cacheKey = buildValidationCacheKey(source)
  const cachedResult = validationCache.get(cacheKey)
  if (cachedResult) {
    return cloneValidateResult(cachedResult)
  }
  const validationId = createValidationId()
  const outputDir = path.join(DEFAULT_OUTPUT_ROOT, validationId)
  const sourcePath = path.join(outputDir, "diagram.mmd")
  const outputPath = path.join(outputDir, "diagram.svg")
  await mkdir(outputDir, { recursive: true })
  await writeFile(sourcePath, source, "utf8")
  try {
    const rendererPath = await resolveRendererPath()
    await runRenderer({
      rendererPath,
      inputPath: sourcePath,
      outputPath,
    })
    return {
      ok: true,
      diagramType,
      diagnostics: [],
    }
  } catch (error) {
    const result = {
      ok: false,
      diagramType,
      diagnostics: [toDiagnostic(error, "error")],
    }
    rememberValidation(cacheKey, result)
    return result
  } finally {
    await rm(outputDir, { recursive: true, force: true })
  }
}
function buildValidationCacheKey(source) {
  return createHash("sha256").update(source).digest("hex")
}
function rememberValidation(cacheKey, result) {
  validationCache.delete(cacheKey)
  validationCache.set(cacheKey, cloneValidateResult(result))
  while (validationCache.size > VALIDATION_CACHE_LIMIT) {
    const oldestKey = validationCache.keys().next().value
    if (!oldestKey) {
      break
    }
    validationCache.delete(oldestKey)
  }
}
function cloneValidateResult(result) {
  return {
    ok: result.ok,
    diagramType: result.diagramType,
    diagnostics: result.diagnostics.map((diagnostic) => ({ ...diagnostic })),
  }
}
