import path from "node:path";
import { pathToFileURL } from "node:url";

export type {
  CompleteDiagramlyAuthToolInput,
  CreateDiagramlyDiagramToolInput,
  DiagramDiagnostic,
  DiagramlyDiagramToolResult,
  DiagramlyInfo,
  ToolDescriptor,
  ToolInputMap,
  ToolName,
  ToolResultMap
} from "./types.js";

export { toolNames } from "./types.js";
export { inferDiagramType } from "./diagram-type.js";
export { describeTools, invokeTool, createDiagramlyDiagramTool, completeDiagramlyAuthTool } from "./tools.js";
export { createSdkServer } from "./sdk-server.js";
export { runStdioServer } from "./stdio.js";
export { summarizeDiagramlyResult, toStructuredContent } from "./serialization.js";

const isExecutedDirectly =
  process.argv[1] !== undefined && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href;

if (isExecutedDirectly) {
  const { runStdioServer } = await import("./stdio.js");
  runStdioServer().catch((error) => {
    console.error("Failed to start Diagramly.ai MCP server:", error);
    process.exit(1);
  });
}
