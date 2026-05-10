import { describeTools as describeRegisteredTools } from "./descriptions.js"
import { inferDiagramType } from "./diagram-type.js"
import {
  completeDiagramlyAuthorization,
  createDiagramlyCloudPreview,
  startDiagramlyAuthorization,
} from "./diagramly-cloud.js"
import type {
  CompleteDiagramlyAuthToolInput,
  CreateDiagramlyDiagramToolInput,
  DiagramlyDiagramToolResult,
  StartDiagramlyAuthToolInput,
  ToolDescriptor,
  ToolInputMap,
  ToolName,
  ToolResultMap,
} from "./types.js"

export function describeTools(): ToolDescriptor[] {
  return describeRegisteredTools()
}

export async function invokeTool<TName extends ToolName>(
  name: TName,
  input: ToolInputMap[TName]
): Promise<ToolResultMap[TName]> {
  switch (name) {
    case "create_diagramly_diagram":
      return (await createDiagramlyDiagramTool(
        input as CreateDiagramlyDiagramToolInput
      )) as ToolResultMap[TName]
    case "start_diagramly_auth":
      return (await startDiagramlyAuthTool(input as StartDiagramlyAuthToolInput)) as ToolResultMap[TName]
    case "complete_diagramly_auth":
      return (await completeDiagramlyAuthTool(
        input as CompleteDiagramlyAuthToolInput
      )) as ToolResultMap[TName]
    default: {
      const exhaustiveCheck: never = name
      throw new Error(`Unsupported tool: ${exhaustiveCheck}`)
    }
  }
}

export async function createDiagramlyDiagramTool(
  input: CreateDiagramlyDiagramToolInput
): Promise<DiagramlyDiagramToolResult> {
  const diagramType = input.diagramType ?? inferDiagramType(input.source)
  const cloudResult = await createDiagramlyCloudPreview({
    source: input.source,
    title: input.title,
    diagramType,
    renderId: input.renderId,
    svgPath: input.svgPath,
    pngPath: input.pngPath,
    htmlPath: input.htmlPath,
  })

  return toToolResult(cloudResult)
}

export async function startDiagramlyAuthTool(
  _input: StartDiagramlyAuthToolInput = {}
): Promise<DiagramlyDiagramToolResult> {
  return toToolResult(await startDiagramlyAuthorization())
}

export async function completeDiagramlyAuthTool(
  input: CompleteDiagramlyAuthToolInput = {}
): Promise<DiagramlyDiagramToolResult> {
  const cloudResult = await completeDiagramlyAuthorization({
    waitSeconds: input.waitSeconds,
  })

  return toToolResult(cloudResult)
}

function toToolResult(
  cloudResult: Awaited<ReturnType<typeof createDiagramlyCloudPreview>>
): DiagramlyDiagramToolResult {
  return {
    ok: cloudResult.diagramly.status !== "error" && cloudResult.diagramly.status !== "authorization_required",
    diagramType: cloudResult.diagramType ?? null,
    diagnostics: cloudResult.diagnostics,
    renderId: cloudResult.renderId,
    svgPath: cloudResult.svgPath,
    pngPath: cloudResult.pngPath,
    htmlPath: cloudResult.htmlPath,
    previewId: cloudResult.previewId,
    previewUrl: cloudResult.previewUrl,
    diagramly: cloudResult.diagramly,
  }
}
