import type { DiagramTheme, MermaidRuntimeStatus } from "./types.js";
export declare function checkMermaidRuntime(): Promise<MermaidRuntimeStatus>;
export declare function resolveRendererPath(): Promise<string>;
export declare function runRenderer(args: {
    rendererPath: string;
    inputPath: string;
    outputPath: string;
    theme?: DiagramTheme;
    width?: number;
    height?: number;
}): Promise<void>;
