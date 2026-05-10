export type DiagramFormat = "svg" | "png" | "html";
export type DiagramTheme = "default" | "neutral" | "dark" | "forest";
export interface DiagramDiagnostic {
    severity: "error" | "warning" | "info";
    message: string;
    line?: number;
    column?: number;
}
export interface ValidateResult {
    ok: boolean;
    diagramType: string | null;
    diagnostics: DiagramDiagnostic[];
}
export interface RenderRequest {
    source: string;
    format?: DiagramFormat;
    exportPng?: boolean;
    title?: string;
    theme?: DiagramTheme;
    outputDir?: string;
    renderId?: string;
}
export interface RenderResult extends ValidateResult {
    renderId?: string;
    previewUrl?: string;
    svgPath?: string;
    pngPath?: string;
    htmlPath?: string;
}
export interface MermaidRuntimeStatus {
    ok: boolean;
    rendererPath?: string;
    message?: string;
}
export interface RenderCacheMetadata {
    cacheKey: string;
    svgPath: string;
    pngPath?: string;
    htmlPath?: string;
}
