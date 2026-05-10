import { existsSync, readFileSync } from "node:fs"
import { mkdir, readFile, rm, writeFile } from "node:fs/promises"
import { homedir } from "node:os"
import path from "node:path"
import { fileURLToPath } from "node:url"

import type { DiagramDiagnostic, DiagramlyInfo } from "./types.js"

const defaultBaseUrl = "https://diagramly.ai"
const clientName = "diagram plugin"
const requestedScopes = ["diagram:write", "diagram:preview"]
const tokenExpirySkewMs = 60_000
const defaultPollIntervalSeconds = 5
const defaultCompleteAuthorizationWaitSeconds = 110
let packagedConfigLoaded = false
let packagedConfig: PackagedDiagramlyConfig = {}

interface PackagedDiagramlyConfig {
  diagramlyBaseUrl?: string
}

interface TokenCache {
  accessToken: string
  tokenType: "Bearer"
  expiresAt: string
  scopes: string[]
  baseUrl: string
  user?: {
    id?: string
    email?: string
    name?: string
  }
}

interface DeviceAuthSession {
  deviceCode: string
  userCode: string
  verificationUri?: string
  verificationUriComplete?: string
  expiresIn: number
  interval?: number
  scopes: string[]
}

interface DevicePollApproved {
  status: "approved"
  accessToken: string
  tokenType: "Bearer"
  expiresIn: number
  scopes: string[]
  user?: TokenCache["user"]
}

interface DevicePollWaiting {
  status: "pending" | "denied" | "expired" | "consumed"
  interval?: number
}

interface DirectDiagramCreateResponse {
  ok: true
  diagramId: string
  versionId: string
  previewUrl: string
  languageKey: string
  languageType: string
  subTypeKey: string
  teamId: string
  visibility: "PRIVATE" | "PUBLIC"
}

export interface DiagramlyCloudPreviewRequest {
  source: string
  title?: string
  diagramType?: string | null
  renderId?: string
  svgPath?: string
  pngPath?: string
  htmlPath?: string
}

export interface DiagramlyCloudPreviewResult {
  previewUrl?: string
  previewId?: string
  diagramType?: string | null
  renderId?: string
  svgPath?: string
  pngPath?: string
  htmlPath?: string
  diagnostics: DiagramDiagnostic[]
  diagramly: DiagramlyInfo
}

interface PendingAuthorizationCache {
  baseUrl: string
  deviceCode: string
  userCode: string
  loginUrl: string
  expiresAt: string
  pollIntervalSeconds: number
}

export async function createDiagramlyCloudPreview(
  request: DiagramlyCloudPreviewRequest
): Promise<DiagramlyCloudPreviewResult> {
  const baseUrl = getDiagramlyBaseUrl()
  const tokenPath = getTokenCachePath()
  const cachedToken = await readCachedToken(baseUrl, tokenPath)

  if (!cachedToken) {
    return authorizationRequiredResult(request, tokenPath)
  }

  const created = await createRemoteDiagram(request, baseUrl, cachedToken.accessToken)
  if (!isInvalidTokenResult(created)) {
    return created
  }

  await removeCachedToken(tokenPath)
  return authorizationRequiredResult(request, tokenPath)
}

export async function startDiagramlyAuthorization(): Promise<DiagramlyCloudPreviewResult> {
  const baseUrl = getDiagramlyBaseUrl()
  const tokenPath = getTokenCachePath()
  const sessionResponse = await fetchJson<DeviceAuthSession>(`${baseUrl}/api/device-auth/create`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
    },
    body: JSON.stringify({
      clientName,
      scopes: requestedScopes,
    }),
  })

  if (!sessionResponse.ok || !sessionResponse.body) {
    return {
      diagnostics: [
        {
          severity: "warning",
          message: `Could not start Diagramly authorization: ${sessionResponse.status} ${sessionResponse.errorMessage}`,
        },
      ],
      diagramly: {
        provider: "diagramly.ai",
        status: "error",
        error: sessionResponse.errorMessage,
        httpStatus: sessionResponse.status,
        tokenCachePath: tokenPath,
      },
    }
  }

  const session = sessionResponse.body
  const loginUrl = getSessionLoginUrl(baseUrl, session)
  const expiresAt = new Date(Date.now() + session.expiresIn * 1000).toISOString()
  const pendingPath = getPendingAuthorizationPath(tokenPath)
  await writePendingAuthorization(pendingPath, {
    baseUrl,
    deviceCode: session.deviceCode,
    userCode: session.userCode,
    loginUrl,
    expiresAt,
    pollIntervalSeconds: normalizePollIntervalSeconds(session.interval),
  })

  return {
    diagnostics: [],
    diagramly: {
      provider: "diagramly.ai",
      status: "authorization_pending",
      loginUrl,
      userCode: session.userCode,
      expiresAt,
      tokenCachePath: tokenPath,
    },
  }
}

export async function completeDiagramlyAuthorization(
  input: {
    waitSeconds?: number
  } = {}
): Promise<DiagramlyCloudPreviewResult> {
  const baseUrl = getDiagramlyBaseUrl()
  const tokenPath = getTokenCachePath()
  const pendingPath = getPendingAuthorizationPath(tokenPath)
  const pending = await readPendingAuthorization(baseUrl, pendingPath)

  if (!pending) {
    return {
      diagnostics: [
        {
          severity: "warning",
          message: "No pending Diagramly authorization was found.",
        },
      ],
      diagramly: {
        provider: "diagramly.ai",
        status: "error",
        error: "authorization_not_pending",
        tokenCachePath: tokenPath,
      },
    }
  }

  const token = await pollPendingAuthorization(
    pending,
    tokenPath,
    pendingPath,
    getCompleteAuthorizationWaitMs(input.waitSeconds)
  )

  if (!token) {
    return {
      diagnostics: [
        {
          severity: "warning",
          message: "Diagramly authorization is still pending. Keep the login page open and continue waiting.",
        },
      ],
      diagramly: {
        provider: "diagramly.ai",
        status: "authorization_pending",
        loginUrl: pending.loginUrl,
        userCode: pending.userCode,
        expiresAt: pending.expiresAt,
        tokenCachePath: tokenPath,
      },
    }
  }

  return {
    diagnostics: [],
    diagramly: {
      provider: "diagramly.ai",
      status: "authorized",
      tokenCachePath: tokenPath,
    },
  }
}

function authorizationRequiredResult(
  request: DiagramlyCloudPreviewRequest,
  tokenPath: string
): DiagramlyCloudPreviewResult {
  return {
    diagramType: request.diagramType,
    renderId: request.renderId,
    svgPath: request.svgPath,
    pngPath: request.pngPath,
    htmlPath: request.htmlPath,
    diagnostics: [
      {
        severity: "warning",
        message:
          "Diagramly.ai authorization is required. Call start_diagramly_auth before retrying create_diagramly_diagram.",
      },
    ],
    diagramly: {
      provider: "diagramly.ai",
      status: "authorization_required",
      httpStatus: 403,
      error: "authorization_required",
      tokenCachePath: tokenPath,
    },
  }
}

function isInvalidTokenResult(
  result: DiagramlyCloudPreviewResult | { status: "invalid_token" }
): result is { status: "invalid_token" } {
  return "status" in result && result.status === "invalid_token"
}

async function createRemoteDiagram(
  request: DiagramlyCloudPreviewRequest,
  baseUrl: string,
  accessToken: string
): Promise<DiagramlyCloudPreviewResult | { status: "invalid_token" }> {
  const language = languageForDiagramType(request.diagramType)
  const response = await fetchJson<DirectDiagramCreateResponse>(`${baseUrl}/api/device-auth/diagrams`, {
    method: "POST",
    headers: {
      authorization: `Bearer ${accessToken}`,
      "content-type": "application/json",
    },
    body: JSON.stringify({
      title: request.title || defaultTitleForDiagramType(request.diagramType),
      source: request.source,
      languageKey: language.languageKey,
      subTypeKey: language.subTypeKey,
      visibility: "PRIVATE",
    }),
  })

  if (response.status === 401 || response.status === 403) {
    return { status: "invalid_token" }
  }

  if (!response.ok || !response.body?.ok) {
    return {
      diagramType: request.diagramType,
      renderId: request.renderId,
      svgPath: request.svgPath,
      pngPath: request.pngPath,
      htmlPath: request.htmlPath,
      diagnostics: [
        {
          severity: "warning",
          message: `Diagramly preview creation failed: ${response.status} ${response.errorMessage}`,
        },
      ],
      diagramly: {
        provider: "diagramly.ai",
        status: "error",
        error: response.errorMessage,
        httpStatus: response.status,
      },
    }
  }

  return {
    previewUrl: response.body.previewUrl,
    previewId: response.body.diagramId,
    diagramType: request.diagramType,
    renderId: request.renderId,
    svgPath: request.svgPath,
    pngPath: request.pngPath,
    htmlPath: request.htmlPath,
    diagnostics: [],
    diagramly: {
      provider: "diagramly.ai",
      status: "created",
      diagramId: response.body.diagramId,
      versionId: response.body.versionId,
    },
  }
}

async function readCachedToken(baseUrl: string, tokenPath: string): Promise<TokenCache | undefined> {
  try {
    const parsed = JSON.parse(await readFile(tokenPath, "utf8")) as Partial<TokenCache>
    if (
      typeof parsed.accessToken !== "string" ||
      parsed.tokenType !== "Bearer" ||
      typeof parsed.expiresAt !== "string" ||
      parsed.baseUrl !== baseUrl ||
      !Array.isArray(parsed.scopes) ||
      !parsed.scopes.includes("diagram:write")
    ) {
      return undefined
    }

    if (new Date(parsed.expiresAt).getTime() <= Date.now() + tokenExpirySkewMs) {
      return undefined
    }

    return parsed as TokenCache
  } catch {
    return undefined
  }
}

async function writeCachedToken(tokenPath: string, token: TokenCache): Promise<void> {
  await mkdir(path.dirname(tokenPath), { recursive: true })
  await writeFile(tokenPath, `${JSON.stringify(token, null, 2)}\n`, {
    encoding: "utf8",
    mode: 0o600,
  })
}

async function removeCachedToken(tokenPath: string): Promise<void> {
  await rm(tokenPath, { force: true })
}

async function pollPendingAuthorization(
  pending: PendingAuthorizationCache,
  tokenPath: string,
  pendingPath: string,
  waitMs: number
): Promise<TokenCache | undefined> {
  const expiresAt = new Date(pending.expiresAt).getTime()
  if (!Number.isFinite(expiresAt) || expiresAt <= Date.now()) {
    await removePendingAuthorization(pendingPath)
    return undefined
  }

  const deadline = Date.now() + Math.min(waitMs, expiresAt - Date.now())
  let pollIntervalSeconds = normalizePollIntervalSeconds(pending.pollIntervalSeconds)

  while (Date.now() < deadline) {
    const remainingMs = deadline - Date.now()
    const waitMsForPoll = Math.min(pollIntervalSeconds * 1000, remainingMs)
    if (waitMsForPoll <= 0) {
      break
    }

    await sleep(waitMsForPoll)

    const pollResponse = await fetchJson<DevicePollApproved | DevicePollWaiting>(
      `${pending.baseUrl}/api/device-auth/poll`,
      {
        method: "POST",
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify({
          deviceCode: pending.deviceCode,
        }),
      }
    )

    if (!pollResponse.ok || !pollResponse.body) {
      continue
    }

    if (pollResponse.body.status === "approved") {
      const token: TokenCache = {
        accessToken: pollResponse.body.accessToken,
        tokenType: pollResponse.body.tokenType,
        expiresAt: new Date(Date.now() + pollResponse.body.expiresIn * 1000).toISOString(),
        scopes: pollResponse.body.scopes,
        baseUrl: pending.baseUrl,
        user: pollResponse.body.user,
      }
      await writeCachedToken(tokenPath, token)
      await removePendingAuthorization(pendingPath)
      return token
    }

    if (
      pollResponse.body.status === "denied" ||
      pollResponse.body.status === "expired" ||
      pollResponse.body.status === "consumed"
    ) {
      await removePendingAuthorization(pendingPath)
      return undefined
    }

    pollIntervalSeconds = normalizePollIntervalSeconds(pollResponse.body.interval ?? pollIntervalSeconds)
    await writePendingAuthorization(pendingPath, {
      ...pending,
      pollIntervalSeconds,
    })
  }

  return undefined
}

async function readPendingAuthorization(
  baseUrl: string,
  pendingPath: string
): Promise<PendingAuthorizationCache | undefined> {
  try {
    const parsed = JSON.parse(await readFile(pendingPath, "utf8")) as Partial<PendingAuthorizationCache>
    if (
      parsed.baseUrl !== baseUrl ||
      typeof parsed.deviceCode !== "string" ||
      typeof parsed.userCode !== "string" ||
      typeof parsed.loginUrl !== "string" ||
      typeof parsed.expiresAt !== "string"
    ) {
      return undefined
    }

    if (new Date(parsed.expiresAt).getTime() <= Date.now()) {
      await removePendingAuthorization(pendingPath)
      return undefined
    }

    return {
      baseUrl: parsed.baseUrl,
      deviceCode: parsed.deviceCode,
      userCode: parsed.userCode,
      loginUrl: parsed.loginUrl,
      expiresAt: parsed.expiresAt,
      pollIntervalSeconds: normalizePollIntervalSeconds(parsed.pollIntervalSeconds),
    }
  } catch {
    return undefined
  }
}

async function writePendingAuthorization(
  pendingPath: string,
  pending: PendingAuthorizationCache
): Promise<void> {
  await mkdir(path.dirname(pendingPath), { recursive: true })
  await writeFile(pendingPath, `${JSON.stringify(pending, null, 2)}\n`, {
    encoding: "utf8",
    mode: 0o600,
  })
}

async function removePendingAuthorization(pendingPath: string): Promise<void> {
  await rm(pendingPath, { force: true })
}

async function fetchJson<T>(
  url: string,
  init: RequestInit
): Promise<{ ok: boolean; status: number; body?: T; errorMessage: string }> {
  try {
    const response = await fetch(url, init)
    const text = await response.text()
    let body: unknown
    if (text) {
      try {
        body = JSON.parse(text)
      } catch {
        body = undefined
      }
    }

    return {
      ok: response.ok,
      status: response.status,
      body: body as T | undefined,
      errorMessage: errorMessageFromBody(body) || response.statusText || "request failed",
    }
  } catch (error) {
    return {
      ok: false,
      status: 0,
      errorMessage: error instanceof Error ? error.message : "request failed",
    }
  }
}

function errorMessageFromBody(body: unknown): string | undefined {
  if (!body || typeof body !== "object") {
    return undefined
  }

  const maybeMessage = (body as { message?: unknown; error?: unknown }).message
  if (typeof maybeMessage === "string") {
    return maybeMessage
  }

  const maybeError = (body as { error?: unknown }).error
  return typeof maybeError === "string" ? maybeError : undefined
}

function languageForDiagramType(diagramType?: string | null): {
  languageKey: string
  subTypeKey: string
} {
  if (diagramType === "zenuml") {
    return { languageKey: "LANG_ZENUML", subTypeKey: "GENERAL" }
  }

  if (diagramType === "flowchart" || diagramType === "graph") {
    return { languageKey: "LANG_MERMAID", subTypeKey: "FLOWCHART" }
  }

  if (diagramType === "sequenceDiagram") {
    return { languageKey: "LANG_MERMAID", subTypeKey: "SEQUENCE" }
  }

  if (diagramType === "mindmap") {
    return { languageKey: "LANG_MERMAID", subTypeKey: "MINDMAP" }
  }

  if (diagramType === "gantt") {
    return { languageKey: "LANG_MERMAID", subTypeKey: "GANTT" }
  }

  return { languageKey: "LANG_MERMAID", subTypeKey: "GENERAL" }
}

function defaultTitleForDiagramType(diagramType?: string | null): string {
  return diagramType ? `Diagramly ${diagramType}` : "Diagramly diagram"
}

function getDiagramlyBaseUrl(): string {
  const config = getPackagedConfig()
  return normalizeUrl(
    process.env.DIAGRAMLY_API_BASE_URL ||
      process.env.DIAGRAMLY_BASE_URL ||
      config.diagramlyBaseUrl ||
      defaultBaseUrl
  )
}

function getSessionLoginUrl(baseUrl: string, session: DeviceAuthSession): string {
  const completeUrl = normalizeSessionUrl(baseUrl, session.verificationUriComplete)
  if (completeUrl) {
    return completeUrl
  }

  const verificationUri = normalizeSessionUrl(baseUrl, session.verificationUri)
  if (verificationUri) {
    const url = new URL(verificationUri)
    url.searchParams.set("code", session.userCode)
    return url.toString()
  }

  return buildFallbackLoginUrl(baseUrl, session.userCode)
}

function normalizeSessionUrl(baseUrl: string, url?: string): string | undefined {
  if (!url) {
    return undefined
  }

  return new URL(url, `${baseUrl}/`).toString()
}

function buildFallbackLoginUrl(baseUrl: string, userCode: string): string {
  const loginBase = normalizeUrl(`${baseUrl}/auth/device`)
  const url = new URL(loginBase)
  url.searchParams.set("code", userCode)
  return url.toString()
}

function getTokenCachePath(): string {
  if (process.env.DIAGRAMLY_TOKEN_CACHE) {
    return path.resolve(process.env.DIAGRAMLY_TOKEN_CACHE)
  }

  if (process.env.DIAGRAMLY_CONFIG_DIR) {
    return path.join(path.resolve(process.env.DIAGRAMLY_CONFIG_DIR), "auth.json")
  }

  return path.join(homedir(), ".diagramly-vibe", "auth.json")
}

function getPendingAuthorizationPath(tokenPath: string): string {
  return path.join(path.dirname(tokenPath), "pending-auth.json")
}

function getCompleteAuthorizationWaitMs(waitSeconds?: number): number {
  if (waitSeconds !== undefined) {
    return Math.max(0, Math.min(waitSeconds, 115)) * 1000
  }

  const rawValue = process.env.DIAGRAMLY_AUTH_COMPLETE_WAIT_SECONDS
  if (!rawValue) {
    return defaultCompleteAuthorizationWaitSeconds * 1000
  }

  const parsed = Number.parseInt(rawValue, 10)
  if (!Number.isFinite(parsed) || parsed < 0) {
    return defaultCompleteAuthorizationWaitSeconds * 1000
  }

  return Math.min(parsed, 115) * 1000
}

function normalizePollIntervalSeconds(interval?: number): number {
  if (!Number.isFinite(interval) || !interval || interval < 1) {
    return defaultPollIntervalSeconds
  }

  return interval
}

function normalizeUrl(url: string): string {
  return url.replace(/\/+$/, "")
}

async function sleep(ms: number): Promise<void> {
  await new Promise<void>((resolve) => {
    setTimeout(resolve, ms)
  })
}

function getPackagedConfig(): PackagedDiagramlyConfig {
  if (packagedConfigLoaded) {
    return packagedConfig
  }

  packagedConfigLoaded = true
  const configPath = path.resolve(
    path.dirname(fileURLToPath(import.meta.url)),
    "..",
    "..",
    "diagramly-config.json"
  )

  if (!existsSync(configPath)) {
    return packagedConfig
  }

  try {
    const parsed = JSON.parse(readFileSync(configPath, "utf8")) as PackagedDiagramlyConfig
    packagedConfig = {
      diagramlyBaseUrl: typeof parsed.diagramlyBaseUrl === "string" ? parsed.diagramlyBaseUrl : undefined,
    }
  } catch {
    packagedConfig = {}
  }

  return packagedConfig
}
