/**
 * graphSerializer.js
 *
 * Converts the live JointJS graph into a plain workflow JSON object.
 *
 * @param {dia.Graph} graph       - The live JointJS graph instance.
 * @param {string}   [workflowId] - The current workflow identity managed by
 *                                  useJointGraph.  Pass undefined / 'new' for an
 *                                  unsaved workflow so the backend generates a
 *                                  real UUID on first save.
 */
export function serializeGraph(graph, workflowId) {
  const nodes = graph
    .getElements()
    .map((node) => {
      const workflow = node.get("workflow") || {};
      const position = node.position();
      const size = node.size();

      return {
        id: String(node.id),
        type: workflow.type,
        position,
        size,
        data: workflow.data || {},
      };
    })
    .filter((node) => node.type);

  const edges = graph.getLinks().map((link) => {
    const source = link.source();
    const target = link.target();

    return {
      id: String(link.id),
      source: String(source.id || ""),
      sourcePort: source.port || null,
      target: String(target.id || ""),
      targetPort: target.port || null,
    };
  });

  // Only embed a real UUID — omit the field when the workflow is still unsaved
  // so that the backend generates its own UUID on POST /flows.
  const hasRealId = workflowId && workflowId !== 'new' && workflowId !== 'local-workflow';

  return {
    ...(hasRealId ? { id: workflowId } : {}),
    name: "Workflow Builder",
    version: 1,
    updatedAt: new Date().toISOString(),
    nodes,
    edges,
  };
}

export function downloadWorkflowJson(workflow) {
  const blob = new Blob([JSON.stringify(workflow, null, 2)], {
    type: "application/json",
  });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = `${workflow.name || "workflow"}.json`;
  anchor.click();
  URL.revokeObjectURL(url);
}
