export function getNodeWorkflow(node) {
  return node?.get("workflow") || null;
}

export function cloneNodeOffset(node, offset = 36) {
  const position = node.position();
  const workflow = node.get("workflow");
  return {
    type: workflow.type,
    position: { x: position.x + offset, y: position.y + offset },
    data: { ...(workflow.data || {}) },
  };
}
