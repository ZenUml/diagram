import { spawn } from "node:child_process"
import { access, readFile } from "node:fs/promises"
import { delimiter } from "node:path"
import path from "node:path"
import { fileURLToPath } from "node:url"

import { buildRuntimeFailureMessage } from "./diagnostics.js"
import { RENDERER_PROTOCOL_VERSION } from "./renderer-protocol.js"
import type { DiagramTheme, MermaidRuntimeStatus } from "./types.js"
import type { RendererOutputFormat, RendererRequest } from "./renderer-protocol.js"

export async function checkMermaidRuntime(): Promise<MermaidRuntimeStatus> {
  try {
    const rendererPath = await resolveRendererPath()
    return {
      ok: true,
      rendererPath,
    }
  } catch (error) {
    return {
      ok: false,
      message: buildRuntimeFailureMessage(error),
    }
  }
}

export async function resolveRendererPath(): Promise<string> {
  const currentDir = path.dirname(fileURLToPath(import.meta.url))
  let cursor = currentDir

  while (true) {
    const bundledRenderer = await resolveBundledRenderer(cursor)
    if (bundledRenderer) {
      return bundledRenderer
    }

    const packageBin = await resolveMermaidCliRenderer(cursor)
    if (packageBin) {
      return packageBin
    }

    const shimPath = path.join(cursor, "node_modules", ".bin", mermaidCliExecutableName())
    try {
      await access(shimPath)
      return shimPath
    } catch {
      // Keep walking upward.
    }

    const parent = path.dirname(cursor)
    if (parent === cursor) {
      break
    }

    cursor = parent
  }

  throw new Error("Could not locate the diagram Mermaid renderer. Update or reinstall the `diagram` plugin.")
}

export async function runRenderer(args: {
  rendererPath: string
  inputPath: string
  outputPath: string
  theme?: DiagramTheme
  width?: number
  height?: number
}): Promise<void> {
  const request: RendererRequest = {
    protocolVersion: RENDERER_PROTOCOL_VERSION,
    inputPath: args.inputPath,
    outputPath: args.outputPath,
    outputFormat: rendererOutputFormat(args.outputPath),
    theme: args.theme,
    width: args.width ? Math.ceil(args.width) : undefined,
    height: args.height ? Math.ceil(args.height) : undefined,
  }

  const shouldInvokeWithNode = isNodeScript(args.rendererPath)
  const command = shouldInvokeWithNode ? process.execPath : args.rendererPath
  const finalArgs = shouldInvokeWithNode ? [args.rendererPath] : []
  const env = { ...process.env }
  env.PUPPETEER_EXECUTABLE_PATH ||= await resolveBrowserExecutable()

  await new Promise<void>((resolve, reject) => {
    const child = spawn(command, finalArgs, {
      env,
    })

    let stderr = ""
    child.stdin.end(`${JSON.stringify(request)}\n`)

    child.stderr.on("data", (chunk) => {
      stderr += String(chunk)
    })

    child.on("error", reject)
    child.on("exit", (code) => {
      if (code === 0) {
        resolve()
        return
      }

      reject(
        new Error(stderr.trim() || `Renderer exited with code ${code ?? "unknown"} while rendering Mermaid.`)
      )
    })
  })
}

function rendererOutputFormat(outputPath: string): RendererOutputFormat {
  const extension = path.extname(outputPath).toLowerCase()
  if (extension === ".svg") {
    return "svg"
  }

  if (extension === ".png") {
    return "png"
  }

  throw new Error("Renderer output path must end with .svg or .png.")
}

async function resolveBrowserExecutable(): Promise<string | undefined> {
  const candidates =
    process.platform === "win32"
      ? windowsBrowserCandidates()
      : process.platform === "darwin"
        ? macBrowserCandidates()
        : unixBrowserCandidates()

  for (const candidate of candidates) {
    if (!candidate) {
      continue
    }

    try {
      await access(candidate)
      return candidate
    } catch {
      // Keep looking.
    }
  }

  return undefined
}

function windowsBrowserCandidates(): string[] {
  const roots = [process.env.PROGRAMFILES, process.env["PROGRAMFILES(X86)"], process.env.LOCALAPPDATA].filter(
    (value): value is string => Boolean(value)
  )

  return roots.flatMap((root) => [
    path.join(root, "Google", "Chrome", "Application", "chrome.exe"),
    path.join(root, "Microsoft", "Edge", "Application", "msedge.exe"),
    path.join(root, "Chromium", "Application", "chrome.exe"),
  ])
}

function macBrowserCandidates(): string[] {
  return [
    "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
    "/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge",
    "/Applications/Chromium.app/Contents/MacOS/Chromium",
  ]
}

function unixBrowserCandidates(): string[] {
  const pathDirs = (process.env.PATH || "").split(delimiter).filter(Boolean)
  const executableNames = [
    "google-chrome-stable",
    "google-chrome",
    "chromium-browser",
    "chromium",
    "microsoft-edge-stable",
    "microsoft-edge",
  ]

  return [
    ...pathDirs.flatMap((dir) => executableNames.map((name) => path.join(dir, name))),
    "/usr/bin/google-chrome",
    "/usr/bin/chromium",
    "/snap/bin/chromium",
  ]
}

async function resolveBundledRenderer(searchRoot: string): Promise<string | undefined> {
  const bundledRendererPaths = [
    path.join(searchRoot, "renderer", "index.cjs"),
    path.join(searchRoot, "renderer", "index.js"),
  ]

  for (const bundledRendererPath of bundledRendererPaths) {
    try {
      await access(bundledRendererPath)
      return bundledRendererPath
    } catch {
      continue
    }
  }

  return undefined
}

async function resolveMermaidCliRenderer(searchRoot: string): Promise<string | undefined> {
  const packageJsonPath = path.join(searchRoot, "node_modules", "@mermaid-js", "mermaid-cli", "package.json")

  try {
    const packageJson = JSON.parse(await readFile(packageJsonPath, "utf8")) as {
      bin?: string | Record<string, string>
    }
    const binValue = typeof packageJson.bin === "string" ? packageJson.bin : packageJson.bin?.mmdc
    if (!binValue) {
      return undefined
    }

    const binPath = path.resolve(path.dirname(packageJsonPath), binValue)
    await access(binPath)
    return binPath
  } catch {
    return undefined
  }
}

function isNodeScript(filePath: string): boolean {
  return [".js", ".cjs", ".mjs"].includes(path.extname(filePath))
}

function mermaidCliExecutableName(): string {
  return process.platform === "win32" ? "mmdc.cmd" : "mmdc"
}
