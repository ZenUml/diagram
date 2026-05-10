import type { RenderCacheMetadata, RenderRequest, RenderResult } from "./types.js";
export declare function buildRenderCacheKey(request: RenderRequest): string;
export declare function tryReuseRenderCache(input: {
    cachePath: string;
    cacheKey: string;
    svgPath: string;
    pngPath?: string;
    htmlPath?: string;
}): Promise<Pick<RenderResult, "svgPath" | "pngPath" | "htmlPath"> | undefined>;
export declare function writeRenderCacheMetadata(cachePath: string, metadata: RenderCacheMetadata): Promise<void>;
