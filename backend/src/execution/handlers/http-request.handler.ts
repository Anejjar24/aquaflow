import { WorkflowNode } from '../../common/types/workflow.types';

export class HttpRequestHandler {
  async execute(node: WorkflowNode, input: unknown) {
    const method = String(node.data?.method || 'GET').toUpperCase();
    const url = String(node.data?.url || '').trim();

    if (!url) {
      return { error: 'url not configured', ok: false };
    }

    let headers: Record<string, string> = { 'Content-Type': 'application/json' };
    try {
      const parsed = JSON.parse(String(node.data?.headers || '{}'));
      headers = { ...headers, ...parsed };
    } catch {
      // ignore malformed headers JSON
    }

    let staticBody: Record<string, unknown> = {};
    try {
      staticBody = JSON.parse(String(node.data?.body || '{}'));
    } catch {
      // ignore malformed body JSON
    }

    const body =
      typeof input === 'object' && input !== null
        ? { ...staticBody, ...(input as Record<string, unknown>) }
        : staticBody;

    const hasBody = !['GET', 'HEAD'].includes(method);

    try {
      const response = await fetch(url, {
        method,
        headers,
        body: hasBody ? JSON.stringify(body) : undefined,
      });

      const text = await response.text();
      let data: unknown = text;
      try {
        data = JSON.parse(text);
      } catch {
        // response is plain text — keep as string
      }

      return {
        ok: response.ok,
        status: response.status,
        statusText: response.statusText,
        data,
        // `value` is the field unwrapBranchValue extracts so downstream nodes
        // (data-transform, action, output…) receive the response body directly
        // rather than the full envelope.  The full envelope (ok, status, data…)
        // is still available in the execution step log.
        value: data,
        branch: response.ok ? 'response' : 'error',
      };
    } catch (err) {
      return {
        ok: false,
        error: err instanceof Error ? err.message : String(err),
        branch: 'error',
      };
    }
  }
}
