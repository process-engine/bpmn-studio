/**
 * This service allows getting the folder where deleted diagrams should be
 * written to.
 */
export class DiagramTrashFolderService {
  private diagramTrashFolder: string | null = null;

  /**
   * Gets the trash folder location on the current platform. This
   * method will ensure that the target folder exists.
   *
   * @return the folder to which deleted diagrams should be moved.
   */
  public getDiagramTrashFolder(): string {
    const serviceIsNotInitialized: boolean = this.diagramTrashFolder === null;
    if (serviceIsNotInitialized) {
      this.initializeDiagramTrashFolder();
    }

    return this.diagramTrashFolder;
  }

  /**
   * Initializes the diagram trash folder.
   */
  private initializeDiagramTrashFolder(): void {
    const path: any = (window as any).nodeRequire('path');
    const os: any = (window as any).nodeRequire('os');
    const fs: any = (window as any).nodeRequire('fs');

    const homeFolder: string = os.homedir();

    // On macOS we can use the ~/.Trash/ folder.
    const platformIsMacOS: boolean = os.platform() === 'darwin';
    if (platformIsMacOS) {
      const systemTrashFolder: string = path.join(homeFolder, '.Trash');
      this.diagramTrashFolder = systemTrashFolder;

      return;
    }

    // On all other platforms we use the ~/.bpmn-studio/deleted-diagrams/ folder.

    const bpmnStudioFolder: string = path.join(homeFolder, '.bpmn-studio');
    const deletedDiagramsFolder: string = path.join(bpmnStudioFolder, 'deleted-diagrams');

    const bpmnStudioFolderDoesNotExist: boolean = !fs.existsSync(bpmnStudioFolder);
    if (bpmnStudioFolderDoesNotExist) {
      fs.mkdirSync(bpmnStudioFolder);
    }

    const deletedDiagramsFolderDoesNotExist: boolean = !fs.existsSync(deletedDiagramsFolder);
    if (deletedDiagramsFolderDoesNotExist) {
      fs.mkdirSync(deletedDiagramsFolder);
    }

    this.diagramTrashFolder = deletedDiagramsFolder;
  }
}
