import { createServer } from "node:http"
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises"
import { tmpdir } from "node:os"
import path from "node:path"
import { setTimeout as delay } from "node:timers/promises"

import { summarizeDiagramlyResult } from "../packages/diagramly-ai-mcp/dist/serialization.js"
import {
  completeDiagramlyAuthTool,
  createDiagramlyDiagramTool,
  startDiagramlyAuthTool,
} from "../packages/diagramly-ai-mcp/dist/tools.js"

function assert(condition, message) {
  if (!condition) {
    throw new Error(message)
  }
}

async function readBody(request) {
  const chunks = []
  for await (const chunk of request) {
    chunks.push(chunk)
  }

  const text = Buffer.concat(chunks).toString("utf8")
  return text ? JSON.parse(text) : {}
}

function writeJson(response, status, body) {
  response.writeHead(status, {
    "content-type": "application/json",
  })
  response.end(JSON.stringify(body))
}

async function listen(server) {
  server.listen(0, "127.0.0.1")
  await new Promise((resolve) => {
    server.once("listening", resolve)
  })

  const address = server.address()
  assert(address && typeof address !== "string", "mock server did not expose a port")
  return `http://127.0.0.1:${address.port}`
}

async function close(server) {
  await new Promise((resolve, reject) => {
    server.close((error) => {
      if (error) {
        reject(error)
      } else {
        resolve()
      }
    })
  })
}

function tokenFor(baseUrl) {
  return {
    accessToken: "dly_mock_access_token",
    tokenType: "Bearer",
    expiresAt: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
    scopes: ["diagram:write", "diagram:preview"],
    baseUrl,
  }
}

const originalEnv = {
  DIAGRAMLY_API_BASE_URL: process.env.DIAGRAMLY_API_BASE_URL,
  DIAGRAMLY_BASE_URL: process.env.DIAGRAMLY_BASE_URL,
  DIAGRAMLY_TOKEN_CACHE: process.env.DIAGRAMLY_TOKEN_CACHE,
  DIAGRAMLY_CONFIG_DIR: process.env.DIAGRAMLY_CONFIG_DIR,
  DIAGRAMLY_AUTH_WAIT_SECONDS: process.env.DIAGRAMLY_AUTH_WAIT_SECONDS,
}

const counters = {
  authCreates: 0,
  diagramCreates: 0,
  polls: 0,
}

let serverUrl = ""
let pollStatus = "pending"

const server = createServer(async (request, response) => {
  const url = new URL(request.url ?? "/", serverUrl)

  if (request.method === "POST" && url.pathname === "/api/device-auth/create") {
    counters.authCreates += 1
    await readBody(request)
    writeJson(response, 200, {
      deviceCode: "mock-device-code",
      userCode: "ABCD-2345",
      verificationUri: `${serverUrl}/auth/device`,
      verificationUriComplete: `${serverUrl}/auth/device?code=ABCD-2345`,
      expiresIn: 600,
      interval: 0,
      scopes: ["diagram:write", "diagram:preview"],
    })
    return
  }

  if (request.method === "POST" && url.pathname === "/api/device-auth/poll") {
    counters.polls += 1
    await readBody(request)
    if (pollStatus === "approved") {
      writeJson(response, 200, {
        status: "approved",
        accessToken: "dly_mock_access_token",
        tokenType: "Bearer",
        expiresIn: 3600,
        scopes: ["diagram:write", "diagram:preview"],
        user: {
          id: "mock-user-id",
          email: "mock@example.com",
          name: "Mock User",
        },
      })
      return
    }

    writeJson(response, 200, {
      status: "pending",
      interval: 0,
    })
    return
  }

  if (request.method === "POST" && url.pathname === "/api/device-auth/diagrams") {
    counters.diagramCreates += 1
    const authorization = request.headers.authorization
    const body = await readBody(request)
    assert(authorization === "Bearer dly_mock_access_token", "diagram create used wrong token")
    assert(typeof body.source === "string" && body.source.includes("flowchart"), "missing source")

    writeJson(response, 200, {
      ok: true,
      diagramId: "mock-diagram-id",
      versionId: "mock-version-id",
      previewUrl: `${serverUrl}/diagrams/mock-diagram-id`,
      languageKey: "LANG_MERMAID",
      languageType: "MERMAID",
      subTypeKey: "FLOWCHART",
      teamId: "mock-team-id",
      visibility: "PRIVATE",
    })
    return
  }

  writeJson(response, 404, {
    error: "not found",
  })
})

const tempDir = await mkdtemp(path.join(tmpdir(), "diagramly-cloud-preview-"))
const tokenPath = path.join(tempDir, "auth.json")

try {
  serverUrl = await listen(server)

  delete process.env.DIAGRAMLY_BASE_URL
  delete process.env.DIAGRAMLY_CONFIG_DIR
  process.env.DIAGRAMLY_API_BASE_URL = serverUrl
  process.env.DIAGRAMLY_TOKEN_CACHE = tokenPath

  await writeFile(tokenPath, `${JSON.stringify(tokenFor(serverUrl), null, 2)}\n`, "utf8")
  const cachedResult = await createDiagramlyDiagramTool({
    source: "flowchart TD\n  A --> B",
    diagramType: "flowchart",
    renderId: "cached-render",
    htmlPath: path.join(tempDir, "cached", "diagram.html"),
    svgPath: path.join(tempDir, "cached", "diagram.svg"),
    pngPath: path.join(tempDir, "cached", "diagram.png"),
  })

  assert(cachedResult.ok, "cached-token Diagramly.ai create failed")
  assert(
    cachedResult.previewUrl === `${serverUrl}/diagrams/mock-diagram-id`,
    "cached-token create did not return the remote preview URL"
  )
  assert(cachedResult.previewId === "mock-diagram-id", "cached-token create missed previewId")
  assert(counters.diagramCreates === 1, "cached-token create did not create exactly one diagram")
  assert(counters.authCreates === 0, "cached-token create should not start device auth")

  await rm(tokenPath, { force: true })
  process.env.DIAGRAMLY_AUTH_WAIT_SECONDS = "0"
  const startedAt = Date.now()
  const pendingInput = {
    source: "flowchart TD\n  A --> C",
    diagramType: "flowchart",
    renderId: "pending-render",
    htmlPath: path.join(tempDir, "pending", "diagram.html"),
    svgPath: path.join(tempDir, "pending", "diagram.svg"),
    pngPath: path.join(tempDir, "pending", "diagram.png"),
  }
  const requiredResult = await createDiagramlyDiagramTool(pendingInput)

  const elapsedMs = Date.now() - startedAt
  assert(!requiredResult.ok, "no-token Diagramly.ai create should require authorization")
  assert(elapsedMs < 10_000, "no-token create should return before host tool timeout")
  assert(
    requiredResult.diagramly?.status === "authorization_required",
    "no-token create should report authorization_required"
  )
  assert(requiredResult.diagramly?.httpStatus === 403, "no-token create should report HTTP 403")
  assert(
    summarizeDiagramlyResult(requiredResult).includes("HTTP Status:   403"),
    "authorization_required summary should include HTTP 403"
  )
  assert(counters.authCreates === 0, "no-token create should not start device auth")
  assert(counters.diagramCreates === 1, "no-token create should not create a diagram")

  const authResult = await startDiagramlyAuthTool()
  assert(authResult.ok, "start auth should succeed")
  assert(
    authResult.diagramly?.loginUrl === `${serverUrl}/auth/device?code=ABCD-2345`,
    "start auth should return the API-provided login URL as diagramly.loginUrl"
  )
  assert(authResult.previewUrl === undefined, "start auth should not return login URL as previewUrl")
  assert(authResult.diagramly?.status === "authorization_pending", "start auth should report pending")
  assert(counters.authCreates === 1, "start auth should create one device auth session")
  assert(counters.diagramCreates === 1, "start auth should not create a diagram")

  const pendingAuthResult = await completeDiagramlyAuthTool({
    waitSeconds: 0,
  })
  assert(pendingAuthResult.ok, "pending auth should be a valid intermediate result")
  assert(
    pendingAuthResult.diagramly?.loginUrl === `${serverUrl}/auth/device?code=ABCD-2345`,
    "pending auth should return the login URL as diagramly.loginUrl"
  )
  assert(pendingAuthResult.previewUrl === undefined, "pending auth should not return login URL as previewUrl")
  assert(
    pendingAuthResult.diagramly?.status === "authorization_pending",
    "pending auth should report authorization_pending"
  )

  pollStatus = "approved"
  const authorizedResult = await completeDiagramlyAuthTool({
    waitSeconds: 10,
  })

  assert(authorizedResult.ok, "complete auth should succeed")
  assert(authorizedResult.diagramly?.status === "authorized", "complete auth should report authorized")
  assert(counters.diagramCreates === 1, "complete auth should not create a diagram")
  const savedToken = JSON.parse(await readFile(tokenPath, "utf8"))
  assert(savedToken.accessToken === "dly_mock_access_token", "completed-auth should cache token")

  const retryResult = await createDiagramlyDiagramTool(pendingInput)
  assert(retryResult.ok, "retry create after auth failed")
  assert(
    retryResult.previewUrl === `${serverUrl}/diagrams/mock-diagram-id`,
    "retry create should return the final Diagramly preview URL"
  )
  assert(retryResult.diagramly?.status === "created", "retry create should report created")
  assert(counters.diagramCreates === 2, "retry create should create the authorized diagram")

  await delay(1)
  console.log(
    JSON.stringify(
      {
        ok: true,
        cachedPreviewUrl: cachedResult.previewUrl,
        authLoginUrl: authResult.diagramly.loginUrl,
        retriedPreviewUrl: retryResult.previewUrl,
        pendingElapsedMs: elapsedMs,
        counters,
      },
      null,
      2
    )
  )
} finally {
  for (const [key, value] of Object.entries(originalEnv)) {
    if (value === undefined) {
      delete process.env[key]
    } else {
      process.env[key] = value
    }
  }

  await close(server)
  await rm(tempDir, { recursive: true, force: true })
}
