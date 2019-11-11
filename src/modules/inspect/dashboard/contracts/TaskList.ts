import {TaskListEntry} from './TaskListEntry';

export type TaskList = {
  taskListEntries: Array<TaskListEntry>;
  totalCount: number;
};
