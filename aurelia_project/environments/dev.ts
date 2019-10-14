const processEngineRoute: string = 'http://localhost:8000';
const electronHost: string = 'bpmn-studio:/';

const isRunningInElectron: boolean = Boolean((window as any).nodeRequire);

export default {
  debug: true,
  testing: true,
  appHost: isRunningInElectron ? electronHost : `http://${window.location.host}`,
  processlist: {
    pageLimit: 10,
  },
  openIdConnect: {
    authority: 'http://localhost:5000',
    defaultAuthority: 'http://localhost:5000',
  },
  processengine: {
    liveExecutionTrackerPollingIntervalInMs: 1000,
    solutionExplorerPollingIntervalInMs: 5000,
    processDefListPollingIntervalInMs: 5000,
    dashboardPollingIntervalInMs: 1500,
    updateRemoteSolutionHistoryIntervalInMs: 3000,
    routes: {
      processes: `${processEngineRoute}/datastore/ProcessDef`,
      startProcess: `${processEngineRoute}/processengine/start`,
      iam: `${processEngineRoute}/iam`,
      userTasks: `${processEngineRoute}/datastore/UserTask`,
      importBPMN: `${processEngineRoute}/processengine/create_bpmn_from_xml`,
    },
  },
  events: {
    differsFromOriginal: 'differsFromOriginal',
    diagramChangedOutsideTheStudio: 'diagramChangedOutsideTheStudio',
    diagramNeedsToBeUpdated: 'diagramNeedsToBeUpdated',
    xmlChanged: 'xmlChanged',
    diagramWasSaved: 'diagramWasSaved',
    deployModals: {
      showRemoteSolutionSelectionModal: 'deployModals:remoteSolutionSelectionModal:show',
      showOverwriteDiagramModal: 'deployModals:overwriteDiagramModal:show',
    },
    startPage: {
      openLocalSolution: 'startpage:openlocalsolution',
      openDiagram: 'startpage:openDiagram',
      createDiagram: 'startpage:createDiagram',
    },
    statusBar: {
      showDiagramViewButtons: 'statusbar:diagramviewbuttons:show',
      hideDiagramViewButtons: 'statusbar:diagramviewbuttons:hide',
      setXmlIdentifier: 'statusbar:xmlIdentifier',
      showInspectCorrelationButtons: 'statusbar:inspectcorrelationbuttons',
    },
    configPanel: {
      solutionEntryChanged: 'configpanel:solutionentry:changed',
    },
    navBar: {
      showTools: 'navbar:tools:show',
      hideTools: 'navbar:tools:hide',
      validationError: 'navbar:validationError:true',
      noValidationError: 'navbar:validationError:false',
      inspectNavigateToDashboard: 'navbar:inspectLink:navigateToDashboard',
      showInspectButtons: 'navbar:tools:showButtonsOnInspect',
      hideInspectButtons: 'navbar:tools:hideButtonsOnInspect',
      toggleDashboardView: 'navbar:tools:inspectButtons:toggleDashboardView',
      toggleHeatmapView: 'navbar:tools:inspectButtons:toggleHeatmapView',
      toggleInspectCorrelationView: 'navbar:tools:inspectButtons:toggleInspectCorrelationView',
      updateActiveSolutionAndDiagram: 'navbar:activeSolution:diagram:update',
    },
    diagramDetail: {
      onDiagramDeployed: 'diagramdetail:diagram:ondeployed',
      printDiagram: 'diagramdetail:diagram:print',
      saveDiagram: 'diagramdetail:diagram:save',
      saveDiagramDone: 'diagramdetail:diagram:save:done',
      saveDiagramAs: 'diagramdetail:diagram:save:as',
      exportDiagramAs: 'diagramdetail:diagram:exportas',
      startProcess: 'diagramdetail:process:start',
      startProcessWithOptions: 'diagramdetail:process:startWithOptions',
      toggleXMLView: 'design:xmlview:toggle',
      uploadProcess: 'diagramdetail:process:upload',
    },
    bpmnio: {
      toggleXMLView: 'design:xmlview:toggle',
      toggleDiffView: 'design:diffview:toggle',
      showDiffDestinationButton: 'design:diffDestinationButton:toggle',
      togglePropertyPanel: 'design:propertypanel:toggle',
      propertyPanelActive: 'design:propertypanel:active',
      bindKeyboard: 'design:keyboard:bind',
      unbindKeyboard: 'design:keyboard:unbind',
    },
    diffView: {
      changeDiffMode: 'diffview:diffmode:change',
      toggleChangeList: 'diffview:changelist:toggle',
      setDiffDestination: 'diffview:diffDestination:set',
    },
    diagramChange: 'diagram:change',
    solutionExplorerPanel: {
      toggleSolutionExplorer: 'solutionExplorerPanel:solutionExplorer:toggle',
    },
    inspect: {
      shouldDisableTokenViewerButton: 'inspect:tokenViewerButton:disable',
      exportDiagramAs: 'inspect:diagram:exportas',
    },
    inspectCorrelation: {
      showInspectPanel: 'inspectCorrelation:inspectPanel:show',
      showTokenViewer: 'inspectCorrelation:tokenViewer:show',
      showLogViewer: 'inpsectCorrelation:logViewer:show',
      noCorrelationsFound: 'inspectCorrelation:diagramViewer:noCorrelationsFound',
      updateProcessInstances: 'inspectCorrelation:updateProcessInstances',
    },
    solutionExplorer: {
      updateOpenDiagrams: 'solutioneExplorer:openDiagrams:update',
    },
  },
  baseRoute: processEngineRoute,
  propertyPanel: {
    defaultWidth: 250,
  },
  colorPickerSettings: {
    preferredFormat: 'hex',
    clickoutFiresChange: true,
    showPalette: true,
    maxSelectionSize: 8,
    showInitial: true,
    showInput: true,
    allowEmpty: true,
    showButtons: false,
    containerClassName: 'colorpicker-container',
  },
};
