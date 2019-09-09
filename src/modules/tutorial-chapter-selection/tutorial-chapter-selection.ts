import {bindable, inject} from 'aurelia-framework';

import {TutorialService} from '../../services/tutorial-service/tutorial.service';
import {Chapter} from '../../contracts/index';

@inject(TutorialService)
export class TutorialChapterSelection {
  @bindable public showChapterSelection: boolean;
  public chapters: Array<Chapter> = [];

  private tutorialService: TutorialService;

  constructor(tutorialService: TutorialService) {
    this.tutorialService = tutorialService;
  }

  public startChapter(chapter: Chapter): void {
    this.showChapterSelection = false;

    chapter.start();
  }

  public showChapterSelectionChanged(): void {
    this.chapters = this.tutorialService.getAllChapters();
  }
}
