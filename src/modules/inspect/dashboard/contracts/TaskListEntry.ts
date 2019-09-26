import {TaskType} from './index';

export type TaskListEntry = {
  id: string;
  flowNodeInstanceId?: string;
  name: string;
  correlationId: string;
  processModelId: string;
  processInstanceId: string;
  taskType: TaskType;
};
