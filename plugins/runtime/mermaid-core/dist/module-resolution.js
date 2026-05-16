import { access } from "node:fs/promises"
import path from "node:path"
import { fileURLToPath, pathToFileURL } from "node:url"
export async function resolveModuleFileUrl(relativePath) {
  const resolvedPath = await resolveLocalModulePath(relativePath)
  return pathToFileURL(resolvedPath).href
}
export async function resolveLocalModulePath(relativePath) {
  const currentDir = path.dirname(fileURLToPath(import.meta.url))
  let cursor = currentDir
  while (true) {
    const candidate = path.join(cursor, relativePath)
    try {
      await access(candidate)
      return candidate
    } catch {
      // Keep walking upward.
    }
    const parent = path.dirname(cursor)
    if (parent === cursor) {
      break
    }
    cursor = parent
  }
  throw new Error(`Could not locate Mermaid parser module: ${relativePath}`)
}
