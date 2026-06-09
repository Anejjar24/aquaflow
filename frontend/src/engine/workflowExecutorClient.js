import { executeWorkflow } from "services/workflowApi";

export async function executeWorkflowGraph(workflow) {
  return executeWorkflow(workflow);
}
