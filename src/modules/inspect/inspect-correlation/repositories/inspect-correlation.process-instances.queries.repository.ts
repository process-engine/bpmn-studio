import {
  ProcessInstance,
  ProcessInstanceList,
} from '@process-engine/management_api_contracts/dist/data_models/correlation';
import {IIdentity} from '@essential-projects/iam_contracts';
import {InspectCorrelationPaginationRepository} from './inspect-correlation.pagination.repository';
import {IInspectCorrelationRepository} from '../contracts';

export class InspectCorrelationProcessInstancesQueryRepository extends InspectCorrelationPaginationRepository
  implements IInspectCorrelationRepository {
  public getProcessInstancesForProcessModel(
    identity: IIdentity,
    processModelId: string,
    offset?: number,
    limit?: number,
  ): Promise<ProcessInstanceList> {
    return this.managementApiService.getProcessInstancesForProcessModel(identity, processModelId, offset, limit);
  }

  public getProcessInstancesById(identity: IIdentity, processInstanceId: string): Promise<ProcessInstance> {
    return this.managementApiService.getProcessInstanceById(identity, processInstanceId);
  }
}
