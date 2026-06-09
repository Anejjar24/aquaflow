import { createWorkflowLink, createWorkflowNode } from "registry/blockFactory";

/**
 * Maps legacy node type strings to their current canonical equivalents.
 *
 * When a saved workflow JSON (from localStorage, a backend DB, or an imported
 * file) contains a node whose type has since been renamed or consolidated,
 * this map silently upgrades it during deserialization so the rest of the
 * app never sees the old type name.
 *
 * Add new entries here whenever a block type is renamed or merged.
 *
 * "api" was the original generic HTTP-call block. It was consolidated into
 * "http-request" (richer properties, separate error port) in TASK 5.
 */
const LEGACY_TYPE_MAP = {
  api: 'http-request',
};

/** Return the current canonical type, upgrading any legacy alias. */
function resolveNodeType(type) {
  return LEGACY_TYPE_MAP[type] ?? type;
}

export function deserializeGraph(graph, workflow) {
  if (!workflow || !Array.isArray(workflow.nodes)) {
    throw new Error("Workflow JSON must contain a nodes array.");
  }

  graph.clear();
  const nodesById = new Map();

  workflow.nodes.forEach((nodeData) => {
    // Silently migrate any legacy type names before constructing the element.
    const type = resolveNodeType(nodeData.type);

    const node = createWorkflowNode(type, nodeData.position || { x: 100, y: 100 }, {
      id: nodeData.id,
      data: nodeData.data || nodeData.properties || {},
      size: nodeData.size,
    });
    node.addTo(graph);
    nodesById.set(String(nodeData.id), node);
  });

  (workflow.edges || []).forEach((edgeData) => {
    const source = nodesById.get(String(edgeData.source));
    const target = nodesById.get(String(edgeData.target));
    if (!source || !target) return;

    createWorkflowLink(
      { id: source.id, port: edgeData.sourcePort || "out" },
      { id: target.id, port: edgeData.targetPort || "in" }
    ).addTo(graph);
  });
}
