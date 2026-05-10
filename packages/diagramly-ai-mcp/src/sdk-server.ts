import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js"

import { getToolDescription, serverInstructions } from "./descriptions.js"
import {
  completeDiagramlyAuthInputSchema,
  createDiagramlyDiagramInputSchema,
  diagramlyDiagramToolOutputSchema,
  startDiagramlyAuthInputSchema,
} from "./schemas.js"
import { summarizeDiagramlyResult, toStructuredContent } from "./serialization.js"
import { completeDiagramlyAuthTool, createDiagramlyDiagramTool, startDiagramlyAuthTool } from "./tools.js"
import type { DiagramlyDiagramToolResult } from "./types.js"

export async function createSdkServer(): Promise<McpServer> {
  const server = new McpServer(
    {
      name: "@diagramly-vibe/diagramly.ai",
      version: "0.1.0",
    },
    {
      instructions: serverInstructions,
      capabilities: {
        logging: {},
      },
    }
  )

  server.registerTool(
    "create_diagramly_diagram",
    {
      title: "Create Diagramly.ai Diagram",
      description: getToolDescription("create_diagramly_diagram"),
      inputSchema: createDiagramlyDiagramInputSchema,
      outputSchema: diagramlyDiagramToolOutputSchema,
    },
    async (input) => toMcpToolResponse(await createDiagramlyDiagramTool(input))
  )

  server.registerTool(
    "start_diagramly_auth",
    {
      title: "Start Diagramly Authorization",
      description: getToolDescription("start_diagramly_auth"),
      inputSchema: startDiagramlyAuthInputSchema,
      outputSchema: diagramlyDiagramToolOutputSchema,
    },
    async (input) => toMcpToolResponse(await startDiagramlyAuthTool(input))
  )

  server.registerTool(
    "complete_diagramly_auth",
    {
      title: "Complete Diagramly Authorization",
      description: getToolDescription("complete_diagramly_auth"),
      inputSchema: completeDiagramlyAuthInputSchema,
      outputSchema: diagramlyDiagramToolOutputSchema,
    },
    async (input) => toMcpToolResponse(await completeDiagramlyAuthTool(input))
  )

  return server
}

function toMcpToolResponse(result: DiagramlyDiagramToolResult) {
  const displayText = summarizeDiagramlyResult(result)
  return {
    content: [
      {
        type: "text" as const,
        text: displayText,
      },
    ],
    structuredContent: toStructuredContent({
      ...result,
      displayText,
    }),
    isError: !result.ok,
  }
}
