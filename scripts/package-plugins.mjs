import * as esbuild from "esbuild"
import { spawn } from "node:child_process"
import { existsSync, readdirSync, readFileSync } from "node:fs"
import { cp, mkdir, rm, writeFile } from "node:fs/promises"
import { createRequire } from "node:module"
import path from "node:path"
import { fileURLToPath } from "node:url"

const rootDir = path.dirname(fileURLToPath(import.meta.url))
const repoRoot = path.resolve(rootDir, "..")

const pluginRoot = path.join(repoRoot, "plugins")
const sharedRuntimeDir = path.join(repoRoot, "tmp", "plugin-runtime")
const packageJsonPath = path.join(repoRoot, "package.json")
const pluginVersionFiles = [
  path.join(pluginRoot, ".codex-plugin", "plugin.json"),
  path.join(pluginRoot, ".claude-plugin", "plugin.json"),
  path.join(pluginRoot, "runtime", "package.json"),
]
loadDotEnvFile(path.join(repoRoot, ".env"))
loadDotEnvFile(path.join(repoRoot, ".env.local"))

async function buildSharedRuntime(runtimeRoot, pluginVersion) {
  await rm(runtimeRoot, { recursive: true, force: true })
  await mkdir(runtimeRoot, { recursive: true })

  await writeFile(
    path.join(runtimeRoot, "package.json"),
    `${JSON.stringify(
      {
        name: "diagram-runtime",
        version: pluginVersion,
        private: true,
        type: "module",
      },
      null,
      2
    )}\n`,
    "utf8"
  )

  await copyMermaidCore(runtimeRoot)
  await bundleDiagramlyAiMcp(runtimeRoot)
  await bundleRenderer(runtimeRoot)
  await copyProductionAssets(runtimeRoot)
  await writeDiagramlyConfig(runtimeRoot)
}

async function copyMermaidCore(runtimeRoot) {
  const mermaidCoreRuntimeDist = path.join(runtimeRoot, "mermaid-core", "dist")

  await cp(
    path.join(repoRoot, "packages", "mermaid-core", "dist"),
    mermaidCoreRuntimeDist,
    { recursive: true }
  )
  await formatGeneratedRuntimeJs(mermaidCoreRuntimeDist)
}

async function bundleDiagramlyAiMcp(runtimeRoot) {
  await bundleRuntimeEntry({
    entryPoint: path.join(repoRoot, "packages", "diagramly-ai-mcp", "dist", "index.js"),
    outfile: path.join(runtimeRoot, "diagramly-ai-mcp", "dist", "index.js"),
  })
}

async function bundleRenderer(runtimeRoot) {
  await bundleRuntimeEntry({
    entryPoint: path.join(repoRoot, "scripts", "runtime-renderer.mjs"),
    outfile: path.join(runtimeRoot, "renderer", "index.cjs"),
    banner: "#!/usr/bin/env node",
    format: "cjs",
  })
}

async function bundleRuntimeEntry({ entryPoint, outfile, banner, format = "esm" }) {
  await mkdir(path.dirname(outfile), { recursive: true })
  await esbuild.build({
    entryPoints: [entryPoint],
    outfile,
    bundle: true,
    platform: "node",
    target: "node18.19",
    format,
    minify: true,
    sourcemap: false,
    legalComments: "none",
    banner: banner ? { js: banner } : undefined,
  })
}

async function formatGeneratedRuntimeJs(targetPath) {
  const jsFiles = collectJavaScriptFiles(targetPath)
  if (jsFiles.length === 0) {
    return
  }

  const biomeBin = path.join(packageDirectory("@biomejs/biome"), "bin", "biome")
  await runCommand(process.execPath, [biomeBin, "format", "--write", ...jsFiles])
}

function collectJavaScriptFiles(directory) {
  const files = []

  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    const entryPath = path.join(directory, entry.name)

    if (entry.isDirectory()) {
      files.push(...collectJavaScriptFiles(entryPath))
      continue
    }

    if (entry.isFile() && entry.name.endsWith(".js")) {
      files.push(entryPath)
    }
  }

  return files
}

async function runCommand(command, args) {
  await new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      cwd: repoRoot,
      stdio: "inherit",
    })

    child.on("error", reject)
    child.on("exit", (code) => {
      if (code === 0) {
        resolve()
        return
      }

      reject(new Error(`${command} ${args.join(" ")} exited with code ${code ?? "unknown"}.`))
    })
  })
}

async function copyProductionAssets(runtimeRoot) {
  const vendorRoot = path.join(runtimeRoot, "vendor")
  const mermaidCliPackageDir = packageDirectory("@mermaid-js/mermaid-cli")
  const mermaidPackageDir = packageDirectory("mermaid")
  const zenumlPackageDir = packageDirectory("@mermaid-js/mermaid-zenuml", mermaidCliPackageDir)

  await cp(path.join(mermaidCliPackageDir, "dist"), path.join(vendorRoot, "mermaid-cli"), { recursive: true })
  await mkdir(path.join(vendorRoot, "mermaid"), { recursive: true })
  await cp(
    path.join(mermaidPackageDir, "dist", "mermaid.min.js"),
    path.join(vendorRoot, "mermaid", "mermaid.min.js")
  )
  await mkdir(path.join(vendorRoot, "mermaid-zenuml"), { recursive: true })
  await cp(
    path.join(zenumlPackageDir, "dist", "mermaid-zenuml.min.js"),
    path.join(vendorRoot, "mermaid-zenuml", "mermaid-zenuml.min.js")
  )
}

function packageDirectory(packageName, fromDirectory = repoRoot) {
  for (const candidate of packageDirectoryCandidates(packageName, fromDirectory)) {
    const packageJsonPath = path.join(candidate, "package.json")
    if (!existsSync(packageJsonPath)) {
      continue
    }

    const packageJson = JSON.parse(readFileSync(packageJsonPath, "utf8"))
    if (packageJson.name === packageName) {
      return candidate
    }
  }

  try {
    const packageRequire = createRequire(path.join(fromDirectory, "package.json"))
    return findPackageRoot(path.dirname(packageRequire.resolve(packageName)), packageName)
  } catch {
    return packageDirectoryFromPnpmStore(packageName)
  }
}

function packageDirectoryCandidates(packageName, fromDirectory) {
  const packagePathParts = packageName.split("/")
  return [
    path.join(fromDirectory, "node_modules", ...packagePathParts),
    path.join(repoRoot, "node_modules", ...packagePathParts),
  ]
}

function packageDirectoryFromPnpmStore(packageName) {
  const encodedPackageName = packageName.replace("/", "+")
  const pnpmStoreRoot = path.join(repoRoot, "node_modules", ".pnpm")
  const entries = readdirSyncSafe(pnpmStoreRoot)
  const storeDirName = entries.find((entry) => entry.startsWith(`${encodedPackageName}@`))

  if (!storeDirName) {
    throw new Error(`Could not locate package root for ${packageName}.`)
  }

  const packageRoot = path.join(pnpmStoreRoot, storeDirName, "node_modules", ...packageName.split("/"))
  const packageJsonPath = path.join(packageRoot, "package.json")
  if (!existsSync(packageJsonPath)) {
    throw new Error(`Could not locate package root for ${packageName}.`)
  }

  return packageRoot
}

function readdirSyncSafe(directory) {
  try {
    return readdirSync(directory)
  } catch {
    return []
  }
}

function findPackageRoot(startDir, packageName) {
  let cursor = startDir

  while (true) {
    const packageJsonPath = path.join(cursor, "package.json")
    if (existsSync(packageJsonPath)) {
      const packageJson = JSON.parse(readFileSync(packageJsonPath, "utf8"))
      if (packageJson.name === packageName) {
        return cursor
      }
    }

    const parent = path.dirname(cursor)
    if (parent === cursor) {
      break
    }

    cursor = parent
  }

  throw new Error(`Could not locate package root for ${packageName}.`)
}

async function writeDiagramlyConfig(runtimeRoot) {
  const diagramlyBaseUrl = process.env.DIAGRAMLY_API_BASE_URL || process.env.DIAGRAMLY_BASE_URL

  if (!diagramlyBaseUrl) {
    return
  }

  await writeFile(
    path.join(runtimeRoot, "diagramly-config.json"),
    `${JSON.stringify(
      {
        diagramlyBaseUrl,
      },
      null,
      2
    )}\n`,
    "utf8"
  )
}

async function copyRuntimeToPlugin(sourceRuntimeRoot) {
  const runtimeRoot = path.join(pluginRoot, "runtime")

  await rm(runtimeRoot, { recursive: true, force: true })
  await mkdir(path.dirname(runtimeRoot), { recursive: true })
  await cp(sourceRuntimeRoot, runtimeRoot, { recursive: true })

  console.log(`Packaged runtime at ${runtimeRoot}`)
}

try {
  const pluginVersion = await preparePluginVersion()
  await syncPluginVersionFiles(pluginVersion)

  await buildSharedRuntime(sharedRuntimeDir, pluginVersion)

  await copyRuntimeToPlugin(sharedRuntimeDir)
  console.log(`Plugin version ${pluginVersion}`)
} finally {
  await rm(sharedRuntimeDir, { recursive: true, force: true })
}

async function preparePluginVersion() {
  const packageJson = readJsonFile(packageJsonPath)
  const currentVersion = parseSemver(packageJson.version, packageJsonPath)
  const versionBump = resolveVersionBump(process.argv.slice(2))

  if (!versionBump) {
    return formatSemver(currentVersion)
  }

  const nextVersion = bumpSemver(currentVersion, versionBump)
  packageJson.version = nextVersion
  await writeJsonFile(packageJsonPath, packageJson)
  console.log(`Bumped plugin version ${formatSemver(currentVersion)} -> ${nextVersion}`)
  return nextVersion
}

function resolveVersionBump(args) {
  const parsed = parseVersionBumpArgs(args)

  if (parsed.help) {
    printUsage()
    process.exit(0)
  }

  return parsed.level
}

function parseVersionBumpArgs(args) {
  const result = { level: undefined, help: false }

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index]

    if (arg === "--help" || arg === "-h") {
      result.help = true
      continue
    }

    if (arg === "--bump") {
      const nextArg = args[index + 1]
      if (isVersionBumpLevel(nextArg)) {
        result.level = assignVersionBumpLevel(result.level, nextArg)
        index += 1
      } else {
        throw new Error("Expected version bump level after --bump: major, minor, or patch.")
      }
      continue
    }

    if (arg.startsWith("--bump=")) {
      const level = arg.slice("--bump=".length)
      if (!isVersionBumpLevel(level)) {
        throw new Error(`Unknown version bump level: ${level}`)
      }
      result.level = assignVersionBumpLevel(result.level, level)
      continue
    }

    if (isVersionBumpLevel(arg)) {
      result.level = assignVersionBumpLevel(result.level, arg)
      continue
    }

    throw new Error(`Unknown argument: ${arg}`)
  }

  return result
}

async function syncPluginVersionFiles(pluginVersion) {
  for (const filePath of pluginVersionFiles) {
    if (!existsSync(filePath)) {
      continue
    }

    const packageJson = readJsonFile(filePath)
    if (packageJson.version === pluginVersion) {
      continue
    }

    packageJson.version = pluginVersion
    await writeJsonFile(filePath, packageJson)
    console.log(`Updated ${path.relative(repoRoot, filePath)} to version ${pluginVersion}`)
  }
}

function readJsonFile(filePath) {
  return JSON.parse(readFileSync(filePath, "utf8"))
}

async function writeJsonFile(filePath, value) {
  await writeFile(filePath, `${JSON.stringify(value, null, 2)}\n`, "utf8")
}

function parseSemver(version, filePath) {
  if (typeof version !== "string") {
    throw new Error(`Missing version in ${path.relative(repoRoot, filePath)}.`)
  }

  const match = version.match(/^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/)
  if (!match) {
    throw new Error(`Expected x.y.z version in ${path.relative(repoRoot, filePath)}, got ${version}.`)
  }

  return {
    major: Number(match[1]),
    minor: Number(match[2]),
    patch: Number(match[3]),
  }
}

function bumpSemver(version, level) {
  if (level === "major") {
    return `${version.major + 1}.0.0`
  }

  if (level === "minor") {
    return `${version.major}.${version.minor + 1}.0`
  }

  return `${version.major}.${version.minor}.${version.patch + 1}`
}

function formatSemver(version) {
  return `${version.major}.${version.minor}.${version.patch}`
}

function isVersionBumpLevel(value) {
  return value === "major" || value === "minor" || value === "patch"
}

function assignVersionBumpLevel(currentLevel, nextLevel) {
  if (currentLevel && currentLevel !== nextLevel) {
    throw new Error(`Conflicting version bump levels: ${currentLevel} and ${nextLevel}`)
  }

  return nextLevel
}

function printUsage() {
  console.log(`Usage:
  node scripts/package-plugins.mjs
  node scripts/package-plugins.mjs --bump major
  node scripts/package-plugins.mjs --bump minor
  node scripts/package-plugins.mjs --bump patch`)
}

function loadDotEnvFile(envPath) {
  if (!existsSync(envPath)) {
    return
  }

  const content = readFileSync(envPath, "utf8")
  for (const line of content.split(/\r?\n/)) {
    const parsed = parseDotEnvLine(line)
    if (!parsed || process.env[parsed.key] !== undefined) {
      continue
    }
    process.env[parsed.key] = parsed.value
  }
}

function parseDotEnvLine(line) {
  const trimmed = line.trim()
  if (!trimmed || trimmed.startsWith("#")) {
    return undefined
  }

  const assignment = trimmed.startsWith("export ") ? trimmed.slice("export ".length).trim() : trimmed
  const separatorIndex = assignment.indexOf("=")
  if (separatorIndex <= 0) {
    return undefined
  }

  const key = assignment.slice(0, separatorIndex).trim()
  if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(key)) {
    return undefined
  }

  return {
    key,
    value: unquoteDotEnvValue(assignment.slice(separatorIndex + 1).trim()),
  }
}

function unquoteDotEnvValue(value) {
  if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
    return value.slice(1, -1)
  }

  const commentIndex = value.indexOf(" #")
  return commentIndex >= 0 ? value.slice(0, commentIndex).trimEnd() : value
}
