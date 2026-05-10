import { createHash } from "node:crypto";
import { access, readFile, writeFile } from "node:fs/promises";
const RENDER_CACHE_VERSION = 2;
export function buildRenderCacheKey(request) {
    return createHash("sha256")
        .update(JSON.stringify({
        rendererVersion: RENDER_CACHE_VERSION,
        source: request.source,
        format: request.format ?? "html",
        exportPng: Boolean(request.exportPng),
        title: request.title ?? "",
        theme: request.theme ?? "",
    }))
        .digest("hex");
}
export async function tryReuseRenderCache(input) {
    try {
        const cache = JSON.parse(await readFile(input.cachePath, "utf8"));
        if (cache.cacheKey !== input.cacheKey) {
            return undefined;
        }
        await access(input.svgPath);
        if (input.pngPath) {
            await access(input.pngPath);
        }
        if (input.htmlPath) {
            await access(input.htmlPath);
        }
        return {
            svgPath: input.svgPath,
            pngPath: input.pngPath,
            htmlPath: input.htmlPath,
        };
    }
    catch {
        return undefined;
    }
}
export async function writeRenderCacheMetadata(cachePath, metadata) {
    await writeFile(cachePath, `${JSON.stringify(metadata, null, 2)}\n`, "utf8");
}
