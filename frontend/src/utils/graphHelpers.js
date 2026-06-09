
/**
 * Convert a drag-drop event's client coordinates into JointJS local (graph) coordinates.
 *
 * IMPORTANT: paper.clientToLocalPoint() already accounts for the paper element's
 * position on the page, its current translation, and its scale.
 * Do NOT subtract rect.left / rect.top first — that causes a double-offset and
 * makes dropped nodes land off-screen (visible only after zooming out).
 */
export function getCanvasDropPoint(event, paper) {
  return paper.clientToLocalPoint({
    x: event.clientX,
    y: event.clientY,
  });
}

export function hasGraphContent(workflow) {
  return Boolean(workflow?.nodes?.length);
}