import type { DiagramDiagnostic } from "./types.js";
export declare function toDiagnostic(error: unknown, severity: DiagramDiagnostic["severity"]): DiagramDiagnostic;
export declare function buildRuntimeFailureMessage(error: unknown): string;
export declare function escapeHtml(value: string): string;
