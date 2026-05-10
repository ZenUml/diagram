import { mkdir, readFile, writeFile } from "node:fs/promises"
import path from "node:path"
import { pathToFileURL } from "node:url"

import puppeteer from "puppeteer-core"

import { RENDERER_PROTOCOL_VERSION } from "../packages/mermaid-core/dist/renderer-protocol.js"

const currentDir = path.dirname(path.resolve(process.argv[1]))
const runtimeRoot = path.resolve(currentDir, "..")
const vendorRoot = path.join(runtimeRoot, "vendor")
const allowedRequestKeys = new Set([
  "protocolVersion",
  "inputPath",
  "outputPath",
  "outputFormat",
  "theme",
  "width",
  "height",
])
const allowedThemes = new Set(["default", "neutral", "dark", "forest"])

async function main() {
  if (process.argv.length > 2) {
    throw new Error("Diagramly renderer reads one JSON object from stdin and does not accept arguments.")
  }

  const request = parseRendererRequest(await readStdin())
  const source = await readFile(request.inputPath, "utf8")
  const browser = await puppeteer.launch({
    headless: "shell",
    executablePath: process.env.PUPPETEER_EXECUTABLE_PATH,
  })

  try {
    const rendered = await renderMermaid(browser, source, request.outputFormat, {
      theme: request.theme ?? "default",
      width: request.width ?? 800,
      height: request.height ?? 600,
    })

    await mkdir(path.dirname(request.outputPath), { recursive: true })
    await writeFile(request.outputPath, rendered)
  } finally {
    await browser.close()
  }
}

async function readStdin() {
  process.stdin.setEncoding("utf8")

  return await new Promise((resolve, reject) => {
    let data = ""
    process.stdin.on("data", (chunk) => {
      data += chunk
    })
    process.stdin.on("error", reject)
    process.stdin.on("end", () => {
      resolve(data)
    })
  })
}

function parseRendererRequest(inputText) {
  let parsed
  try {
    parsed = JSON.parse(inputText)
  } catch {
    throw new Error("Renderer input must be a valid JSON object.")
  }

  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new Error("Renderer input must be a JSON object.")
  }

  for (const key of Object.keys(parsed)) {
    if (!allowedRequestKeys.has(key)) {
      throw new Error(`Unsupported renderer request field: ${key}`)
    }
  }

  if (parsed.protocolVersion !== RENDERER_PROTOCOL_VERSION) {
    throw new Error(`Unsupported renderer protocol version: ${parsed.protocolVersion}`)
  }

  if (typeof parsed.inputPath !== "string" || !parsed.inputPath) {
    throw new Error("Renderer request inputPath must be a non-empty string.")
  }

  if (typeof parsed.outputPath !== "string" || !parsed.outputPath) {
    throw new Error("Renderer request outputPath must be a non-empty string.")
  }

  if (parsed.outputFormat !== "svg" && parsed.outputFormat !== "png") {
    throw new Error("Renderer request outputFormat must be svg or png.")
  }

  if (parsed.theme !== undefined && !allowedThemes.has(parsed.theme)) {
    throw new Error("Renderer request theme is invalid.")
  }

  if (parsed.width !== undefined && (!Number.isInteger(parsed.width) || parsed.width < 1)) {
    throw new Error("Renderer request width must be a positive integer.")
  }

  if (parsed.height !== undefined && (!Number.isInteger(parsed.height) || parsed.height < 1)) {
    throw new Error("Renderer request height must be a positive integer.")
  }

  return parsed
}

async function renderMermaid(browser, definition, outputFormat, options) {
  const page = await browser.newPage()
  page.on("console", (message) => {
    console.warn(message.text())
  })

  try {
    await page.setViewport({ width: options.width, height: options.height })
    await page.goto(pathToFileURL(path.join(vendorRoot, "mermaid-cli", "index.html")).href)
    await page.$eval("body", (body) => {
      body.style.background = "white"
    })
    await Promise.all([
      page.addScriptTag({ path: path.join(vendorRoot, "mermaid", "mermaid.min.js") }),
      page.addScriptTag({ path: path.join(vendorRoot, "mermaid-zenuml", "mermaid-zenuml.min.js") }),
    ])

    await page.$eval(
      "#container",
      async (container, renderOptions) => {
        const mermaid = globalThis.mermaid
        const zenuml = globalThis["mermaid-zenuml"]
        const elkLayouts = globalThis.elkLayouts

        await Promise.all(Array.from(document.fonts, (font) => font.load()))
        if (zenuml) {
          await mermaid.registerExternalDiagrams([zenuml])
        }
        if (elkLayouts) {
          mermaid.registerLayoutLoaders(elkLayouts)
        }

        mermaid.initialize({ startOnLoad: false, theme: renderOptions.theme })
        const { svg } = await mermaid.render("my-svg", renderOptions.definition, container)
        container.innerHTML = svg

        const svgElement = container.getElementsByTagName("svg")?.[0]
        if (!svgElement) {
          throw new Error("Mermaid did not produce an SVG element.")
        }
        svgElement.style.backgroundColor = "white"
      },
      { definition, theme: options.theme }
    )

    if (outputFormat === "svg") {
      const svgXml = await page.$eval("svg", (svg) => new XMLSerializer().serializeToString(svg))
      return new TextEncoder().encode(svgXml)
    }

    const clip = await page.$eval("svg", (svg) => {
      const rect = svg.getBoundingClientRect()
      return {
        x: Math.floor(rect.left),
        y: Math.floor(rect.top),
        width: Math.ceil(rect.width),
        height: Math.ceil(rect.height),
      }
    })
    await page.setViewport({ width: clip.x + clip.width, height: clip.y + clip.height })
    return await page.screenshot({ clip, omitBackground: false })
  } finally {
    await page.close()
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error))
  process.exitCode = 1
})
