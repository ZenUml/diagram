import { access, rm } from "node:fs/promises"
import { homedir } from "node:os"
import path from "node:path"

const homeDir = process.env.HOME || process.env.USERPROFILE || homedir()

if (!homeDir) {
  throw new Error("HOME is not set. Cannot locate the Codex plugin cache.")
}

const cacheTargets = [path.join(homeDir, ".codex", "plugins", "cache", "diagram", "diagram")]

const removed = []
const failed = []

for (const target of cacheTargets) {
  try {
    await access(target)
  } catch {
    continue
  }

  try {
    await rm(target, { recursive: true, force: true })
    removed.push(target)
  } catch (error) {
    failed.push({ target, error })
  }
}

if (removed.length === 0 && failed.length === 0) {
  console.log("No cached diagram plugin copies were found.")
} else if (removed.length > 0) {
  console.log("Removed cached diagram plugin copies:")
  for (const target of removed) {
    console.log(`- ${target}`)
  }
}

if (failed.length > 0) {
  console.error("Failed to remove cached diagram plugin copies:")
  for (const failure of failed) {
    const message = failure.error instanceof Error ? failure.error.message : String(failure.error)
    console.error(`- ${failure.target}: ${message}`)
  }
  console.error("Close Codex Desktop and Codex CLI sessions, then run this command again.")
  process.exitCode = 1
}
