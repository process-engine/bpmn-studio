import {DataModels} from '@process-engine/management_api_contracts';

export type TaskSource =
  | DataModels.EmptyActivities.EmptyActivity
  | DataModels.ManualTasks.ManualTask
  | DataModels.UserTasks.UserTask;
