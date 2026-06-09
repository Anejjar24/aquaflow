import { Injectable } from '@nestjs/common';
import { ExecutionResult, WorkflowEdge, WorkflowGraph, WorkflowNode } from '../../common/types/workflow.types';
import { RealtimeService } from '../../realtime/realtime.service';
import { ExecutionContext } from './execution-context';
import { NodeExecutor } from './node-executor';

@Injectable()
export class WorkflowRunner {
  constructor(
    private readonly nodeExecutor: NodeExecutor,
    private readonly realtimeService: RealtimeService,
  ) {}

  /**
   * Execute a workflow graph, optionally streaming real-time node-level events
   * to the authenticated user via Socket.IO.
   *
   * Events emitted (only when `userId` is supplied):
   *   workflow:started          — once, before the first node runs
   *   workflow:node-executing   — before each node's handler is called
   *   workflow:node-executed    — after each node completes (status: 'success'|'error')
   *   workflow:completed        — once, after all nodes finish successfully
   *   workflow:failed           — once, if an unhandled exception aborts the run
   */
  async run(
    graph: WorkflowGraph,
    input: Record<string, unknown> = {},
    userId?: string,
  ): Promise<ExecutionResult> {
    const context = new ExecutionContext(input);
    const nodes = new Map(graph.nodes.map((node) => [node.id, node]));
    const outgoing = this.groupEdges(graph.edges, 'source');
    const incoming = this.groupEdges(graph.edges, 'target');
    const starts = graph.nodes.filter((node) => node.type === 'input' || !incoming.get(node.id)?.length);
    const queue = [...starts];
    const visited = new Set<string>();
    let finalOutput: unknown = null;

    // ── Notify client: run is beginning ──────────────────────────────────────
    if (userId) {
      this.realtimeService.broadcastToUser(userId, 'workflow:started', {
        workflowId: graph.id,
        nodeCount: graph.nodes.length,
      });
    }

    try {
      while (queue.length) {
        const node = queue.shift() as WorkflowNode;
        if (visited.has(node.id)) continue;
        visited.add(node.id);

        const previousEdges = incoming.get(node.id) || [];
        const previousInput = previousEdges.length
          ? this.unwrapBranchValue(context.getValue(previousEdges[0].source))
          : input;

        // ── Notify client: this node is about to run ────────────────────────
        if (userId) {
          this.realtimeService.broadcastToUser(userId, 'workflow:node-executing', {
            workflowId: graph.id,
            nodeId: node.id,
            type: node.type,
          });
        }

        let output: unknown;
        try {
          output = await this.nodeExecutor.execute(node, previousInput, context);
        } catch (nodeErr) {
          // ── Node threw — emit error event then propagate ──────────────────
          if (userId) {
            this.realtimeService.broadcastToUser(userId, 'workflow:node-executed', {
              workflowId: graph.id,
              nodeId: node.id,
              type: node.type,
              status: 'error',
              error: nodeErr instanceof Error ? nodeErr.message : String(nodeErr),
            });
          }
          throw nodeErr;
        }

        context.setValue(node.id, output);
        context.addStep({ nodeId: node.id, type: node.type, input: previousInput, output });

        // ── Notify client: node completed successfully ──────────────────────
        if (userId) {
          this.realtimeService.broadcastToUser(userId, 'workflow:node-executed', {
            workflowId: graph.id,
            nodeId: node.id,
            type: node.type,
            status: 'success',
          });
        }

        if (node.type === 'output') finalOutput = output;

        const nextEdges = this.filterDecisionEdges(node, output, outgoing.get(node.id) || []);
        nextEdges.forEach((edge) => {
          const target = nodes.get(edge.target);
          if (target) queue.push(target);
        });
      }
    } catch (err) {
      // ── Notify client: the entire run failed ─────────────────────────────
      if (userId) {
        this.realtimeService.broadcastToUser(userId, 'workflow:failed', {
          workflowId: graph.id,
          error: err instanceof Error ? err.message : String(err),
        });
      }
      throw err;
    }

    // ── Notify client: all nodes finished ────────────────────────────────────
    if (userId) {
      this.realtimeService.broadcastToUser(userId, 'workflow:completed', {
        workflowId: graph.id,
        status: 'success',
        stepCount: context.steps.length,
      });
    }

    return {
      workflowId: graph.id,
      status: 'success',
      output: finalOutput,
      steps: context.steps,
    };
  }

  private groupEdges(edges: WorkflowEdge[], key: 'source' | 'target') {
    return edges.reduce((groups, edge) => {
      const id = edge[key];
      groups.set(id, [...(groups.get(id) || []), edge]);
      return groups;
    }, new Map<string, WorkflowEdge[]>());
  }

  /**
   * Branching nodes (decision, data-transform, threshold-check, http-request)
   * return a routing envelope  { value, branch, …metadata }  where:
   *   - `branch`  tells the runner which outgoing port to follow
   *   - `value`   is the actual data payload for the next node
   *
   * Strip the envelope before forwarding so downstream nodes (action, output,
   * notification, etc.) always receive the clean data value, not routing
   * metadata.  Nodes whose output has no `value` key (e.g. http-request
   * returns { data, status, branch }) are left untouched — the whole object
   * passes through because those fields are genuinely useful downstream.
   */
  private unwrapBranchValue(output: unknown): unknown {
    if (
      typeof output === 'object' &&
      output !== null &&
      'branch' in output &&
      'value' in output
    ) {
      return (output as Record<string, unknown>)['value'];
    }
    return output;
  }

  private filterDecisionEdges(node: WorkflowNode, output: unknown, edges: WorkflowEdge[]) {
    // Any handler can return a { branch } field to drive port-based routing
    if (typeof output !== 'object' || output === null || !('branch' in output)) {
      return edges;
    }

    const branch = String((output as { branch: string }).branch);
    return edges.filter((edge) => !edge.sourcePort || edge.sourcePort === branch);
  }
}
