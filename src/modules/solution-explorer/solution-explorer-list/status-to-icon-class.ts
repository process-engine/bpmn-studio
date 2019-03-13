import {SolutionStatus} from '../../../contracts';

export class StatusToIconClassValueConverter {

  public toView(value: SolutionStatus): string {

    if (value === 'disconnected') {
      return 'fa-bolt';
    }
    if (value  === 'folder') {
      return 'fa-folder';
    }
    if (value === 'singleDiagram') {
      return 'fa-copy';
    }
    if (value === 'remote') {
      return 'fa-database';
    }
  }
}
