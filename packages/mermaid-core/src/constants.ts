import { platform, tmpdir } from "node:os";
import path from "node:path";

const defaultBaseDir = platform() === "win32" ? tmpdir() : "/tmp";

export const DEFAULT_OUTPUT_ROOT = path.join(defaultBaseDir, "dv");
export const VALIDATION_CACHE_LIMIT = 128;
