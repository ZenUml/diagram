const DIAGRAM_TYPE_PATTERNS: ReadonlyArray<{
  name: string;
  pattern: RegExp;
}> = [
  { name: "zenuml", pattern: /^\s*zenuml\b/i },
  { name: "architecture", pattern: /^\s*architecture\b/ },
  { name: "block", pattern: /^\s*block(-beta)?\b/ },
  { name: "C4Context", pattern: /^\s*C4Context\b/ },
  { name: "C4Container", pattern: /^\s*C4Container\b/ },
  { name: "C4Component", pattern: /^\s*C4Component\b/ },
  { name: "C4Dynamic", pattern: /^\s*C4Dynamic\b/ },
  { name: "C4Deployment", pattern: /^\s*C4Deployment\b/ },
  { name: "classDiagram-v2", pattern: /^\s*classDiagram-v2\b/ },
  { name: "classDiagram", pattern: /^\s*classDiagram\b/ },
  { name: "erDiagram", pattern: /^\s*erDiagram\b/ },
  { name: "flowchart-elk", pattern: /^\s*flowchart-elk\b/ },
  { name: "flowchart", pattern: /^\s*flowchart\b/ },
  { name: "graph", pattern: /^\s*graph\b/ },
  { name: "gantt", pattern: /^\s*gantt\b/ },
  { name: "gitGraph", pattern: /^\s*gitGraph\b/ },
  { name: "ishikawa", pattern: /^\s*ishikawa(-beta)?\b/i },
  { name: "journey", pattern: /^\s*journey\b/ },
  { name: "kanban", pattern: /^\s*kanban\b/ },
  { name: "mindmap", pattern: /^\s*mindmap\b/ },
  { name: "packet", pattern: /^\s*packet(-beta)?\b/ },
  { name: "pie", pattern: /^\s*pie\b/ },
  { name: "quadrantChart", pattern: /^\s*quadrantChart\b/ },
  { name: "radar-beta", pattern: /^\s*radar-beta\b/ },
  { name: "requirementDiagram", pattern: /^\s*requirement(Diagram)?\b/ },
  { name: "sankey", pattern: /^\s*sankey(-beta)?\b/ },
  { name: "sequenceDiagram", pattern: /^\s*sequenceDiagram\b/ },
  { name: "stateDiagram-v2", pattern: /^\s*stateDiagram-v2\b/ },
  { name: "stateDiagram", pattern: /^\s*stateDiagram\b/ },
  { name: "timeline", pattern: /^\s*timeline\b/ },
  { name: "treeView-beta", pattern: /^\s*treeView-beta\b/ },
  { name: "treemap", pattern: /^\s*treemap(-beta)?\b/ },
  { name: "venn", pattern: /^\s*venn\b/ },
  { name: "wardley-beta", pattern: /^\s*wardley-beta\b/i },
  { name: "xychart", pattern: /^\s*xychart(-beta)?\b/ }
];

export function inferDiagramType(source: string): string | null {
  const candidateLine = findDiagramDeclarationLine(source);
  if (!candidateLine) {
    return null;
  }

  for (const { name, pattern } of DIAGRAM_TYPE_PATTERNS) {
    if (pattern.test(candidateLine)) {
      return name;
    }
  }

  return candidateLine;
}

function findDiagramDeclarationLine(source: string): string | null {
  const lines = source.split(/\r?\n/);
  let index = 0;

  if (lines[index]?.trim() === "---") {
    index += 1;
    while (index < lines.length && lines[index].trim() !== "---") {
      index += 1;
    }
    if (index < lines.length) {
      index += 1;
    }
  }

  for (; index < lines.length; index += 1) {
    const trimmedLine = lines[index].trim();
    if (!trimmedLine || trimmedLine.startsWith("%%")) {
      continue;
    }
    return trimmedLine;
  }

  return null;
}
