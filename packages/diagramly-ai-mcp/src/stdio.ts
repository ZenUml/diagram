import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";

import { createSdkServer } from "./sdk-server.js";

export async function runStdioServer(): Promise<void> {
  const server = await createSdkServer();
  const transport = new StdioServerTransport();
  await server.connect(transport);

  const shutdown = async () => {
    process.stdin.pause();
    await server.close();
  };

  process.stdin.on("close", () => {
    shutdown().catch((error) => {
      console.error("Failed to close Diagramly.ai MCP server:", error);
    });
  });

  process.on("SIGINT", () => {
    shutdown()
      .then(() => process.exit(0))
      .catch((error) => {
        console.error("Failed to shut down Diagramly.ai MCP server:", error);
        process.exit(1);
      });
  });
}
