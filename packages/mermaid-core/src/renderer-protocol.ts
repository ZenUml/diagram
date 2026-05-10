import type { DiagramTheme } from "./types.js"

export const RENDERER_PROTOCOL_VERSION = 1

export type RendererOutputFormat = "svg" | "png"

export interface RendererRequest {
  protocolVersion: typeof RENDERER_PROTOCOL_VERSION
  inputPath: string
  outputPath: string
  outputFormat: RendererOutputFormat
  theme?: DiagramTheme
  width?: number
  height?: number
}
