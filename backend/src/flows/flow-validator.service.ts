import { BadRequestException, Injectable } from '@nestjs/common';
import { WorkflowGraph } from '../common/types/workflow.types';

const validTypes = new Set([
  // Generic blocks
  'input', 'output', 'action', 'decision', 'delay', 'notification',
  // 'api' is a legacy alias for 'http-request' — retained so that workflows
  // persisted in the DB before TASK 5 remain valid and executable.
  'api',
  // Data blocks
  'data-transform',
  // Industrial blocks — core
  'sensor-read', 'threshold-check', 'alert-trigger',
  'mqtt-publish', 'pump-control', 'station-control',
  // Industrial blocks — extended
  'value-transform', 'sensor-check', 'data-aggregate',
  'stream-filter', 'data-output',
  // Integration blocks
  'http-request',
  // Custom calculation block
  'custom-calc',
]);

@Injectable()
export class FlowValidatorService {
  validate(graph: WorkflowGraph) {
    if (!graph || !Array.isArray(graph.nodes) || !Array.isArray(graph.edges)) {
      throw new BadRequestException('Workflow graph must contain nodes and edges arrays.');
    }

    // ── 1. Node validation ────────────────────────────────────────────────────
    const nodeIds = new Set<string>();
    graph.nodes.forEach((node) => {
      if (!node.id || !validTypes.has(node.type)) {
        throw new BadRequestException(`Invalid node "${node.id || 'unknown'}".`);
      }
      if (nodeIds.has(node.id)) {
        throw new BadRequestException(`Duplicate node id "${node.id}".`);
      }
      nodeIds.add(node.id);
    });

    // ── 2. Edge validation + adjacency list + port-occupancy check ───────────
    const adjacency = new Map<string, string[]>();
    for (const id of nodeIds) adjacency.set(id, []);

    // Tracks which (node, port) pairs already have an incoming edge.
    // Key format: "<targetNodeId>:<targetPort>"
    // Enforces the one-incoming-edge-per-input-port invariant so execution is
    // unambiguous — there is never a question of "which value wins?".
    const occupiedPorts = new Set<string>();

    graph.edges.forEach((edge) => {
      if (!nodeIds.has(edge.source) || !nodeIds.has(edge.target)) {
        throw new BadRequestException(
          `Invalid edge from "${edge.source}" to "${edge.target}": one or both nodes do not exist.`,
        );
      }
      if (edge.source === edge.target) {
        throw new BadRequestException(
          `Self-referencing edge on node "${edge.source}" is not allowed.`,
        );
      }
      // Port-occupancy check (only when targetPort is specified).
      if (edge.targetPort) {
        const portKey = `${edge.target}:${edge.targetPort}`;
        if (occupiedPorts.has(portKey)) {
          throw new BadRequestException(
            `Port "${edge.targetPort}" on node "${edge.target}" already has an incoming connection. ` +
              'Each input port may have at most one incoming edge.',
          );
        }
        occupiedPorts.add(portKey);
      }
      adjacency.get(edge.source)!.push(edge.target);
    });

    // ── 3. Cycle detection (DFS grey/black colouring) ─────────────────────────
    // Must run AFTER the adjacency map is fully built.
    const cycle = this.detectCycles(nodeIds, adjacency);
    if (cycle) {
      throw new BadRequestException(
        `Workflow contains a cycle: ${cycle.join(' → ')}. ` +
          'Cyclic graphs cannot be executed — remove the back edge to fix this.',
      );
    }

    return true;
  }

  /**
   * DFS-based cycle detection on a directed graph.
   *
   * Three-colour algorithm:
   *   WHITE (0) — node not yet visited
   *   GREY  (1) — node is on the current DFS call-stack (recursion in progress)
   *   BLACK (2) — node fully processed; no cycle reachable from it
   *
   * A GREY→GREY edge is a back-edge, which proves a directed cycle exists.
   *
   * @returns The cycle as an ordered array of node IDs where the first and last
   *          element are the same (e.g. ["A","B","C","A"]), or null if acyclic.
   */
  private detectCycles(
    nodeIds: Set<string>,
    adjacency: Map<string, string[]>,
  ): string[] | null {
    const WHITE = 0;
    const GREY = 1;
    const BLACK = 2;

    const color = new Map<string, number>();
    for (const id of nodeIds) color.set(id, WHITE);

    // Mutable stack shared across the recursive closure — tracks the current path.
    const stack: string[] = [];

    const dfs = (id: string): string[] | null => {
      color.set(id, GREY);
      stack.push(id);

      for (const neighbour of (adjacency.get(id) ?? [])) {
        const neighbourColor = color.get(neighbour);

        if (neighbourColor === GREY) {
          // Back-edge detected: extract the cycle portion from the stack.
          // stack.indexOf(neighbour) gives the position where the cycle starts.
          const cycleStart = stack.indexOf(neighbour);
          return [...stack.slice(cycleStart), neighbour]; // first === last
        }

        if (neighbourColor === WHITE) {
          const cycle = dfs(neighbour);
          if (cycle !== null) return cycle;
        }
        // BLACK → already fully explored, guaranteed acyclic from here; skip.
      }

      stack.pop();
      color.set(id, BLACK);
      return null;
    };

    // Iterate over every node so disconnected components are also checked.
    for (const id of nodeIds) {
      if (color.get(id) === WHITE) {
        const cycle = dfs(id);
        if (cycle !== null) return cycle;
      }
    }

    return null;
  }
}
