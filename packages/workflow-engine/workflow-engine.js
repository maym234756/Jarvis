import { WORKFLOW_TEMPLATES } from "./templates.js";

export class WorkflowEngine {
  select(taskType) {
    return WORKFLOW_TEMPLATES[taskType] || WORKFLOW_TEMPLATES.chat;
  }

  list() {
    return Object.values(WORKFLOW_TEMPLATES);
  }
}
