import fs from 'fs';
import path from 'path';
import {exposeFunctionForTesting} from '../../../src/services/expose-functionality-module/expose-functionality.module';

const media = {
  video: {
    tag: 'video',
    type: 'video/x-matroska;codecs=avc1',
    ext: '.mp4',
  },
};

const LOCALSTORAGE_ISRECORDING = 'tests:screen-recorder:is-recording';
const LOCALSTORAGE_FILEPATH = 'test:screen-recorder:file-path';

export class ScreenRecorder {
  private mediaRecorder: any;
  private recordedBlobs: Array<Blob> = [];
  private isRecording: boolean = false;
  private filepath: string;

  constructor() {
    window.onbeforeunload = (): void => {
      if (this.isRecording) {
        this.stopRecordingAndSave();
        window.localStorage.setItem(LOCALSTORAGE_ISRECORDING, JSON.stringify(true));
      }
    };

    exposeFunctionForTesting('startRecording', (filepath: string) => {
      this.startRecording(filepath);
    });

    exposeFunctionForTesting('stopRecording', () => {
      this.stopRecording();
    });

    exposeFunctionForTesting('stopRecordingAndSave', () => {
      this.stopRecordingAndSave();
    });
    const item = JSON.parse(window.localStorage.getItem(LOCALSTORAGE_ISRECORDING));

    if (item !== null) {
      this.isRecording = item;
    }

    if (this.isRecording) {
      this.filepath = JSON.parse(window.localStorage.getItem(LOCALSTORAGE_FILEPATH));
      this.startRecording(this.filepath);
    }
  }

  /**
   * Records the BPMN Studio window
   */
  public async startRecording(filepath: string): Promise<void> {
    this.filepath = filepath;
    this.isRecording = true;
    window.localStorage.setItem(LOCALSTORAGE_ISRECORDING, JSON.stringify(this.isRecording));

    const bpmnStudioWindow = await this.getBpmnStudioWindow();

    navigator.mediaDevices
      .getUserMedia({
        audio: false,
        video: {
          mandatory: {
            chromeMediaSource: 'desktop',
            chromeMediaSourceId: bpmnStudioWindow.id,
            minWidth: 1280,
            maxWidth: 1280,
            minHeight: 720,
            maxHeight: 720,
          },
        },
      } as any)
      .then(this.handleStream)
      .catch(this.handleUserMediaError);
  }

  public async stopRecordingAndSave(): Promise<void> {
    if (this.isRecording) {
      window.localStorage.removeItem(LOCALSTORAGE_ISRECORDING);
    }
    this.isRecording = false;
    this.mediaRecorder.stop();

    const blob = new Blob(this.recordedBlobs, {type: media.video.type});
    const arrayBuffer = await (blob as any).arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    if (!fs.existsSync(path.dirname(this.filepath))) {
      fs.mkdirSync(path.dirname(this.filepath), {recursive: true});
    } else if (this.filepath.match(/-\d+.webm/)) {
      const baseName = path.basename(this.filepath, '.webm');

      const lastIndexOfMinus = baseName.lastIndexOf('-');
      let number = JSON.parse(baseName.substr(lastIndexOfMinus + 1));
      number++;

      this.filepath = `${`${path.dirname(this.filepath)}/${baseName.substr(0, lastIndexOfMinus)}-${number}`}.webm`;
    } else {
      this.filepath = `${`${path.dirname(this.filepath)}/${path.basename(this.filepath, '.webm')}-1`}.webm`;
    }

    fs.writeFile(this.filepath, buffer, (error) => {
      if (error) {
        console.error(`Failed to save video ${error}`);
      } else {
        console.log(`Saved video: ${this.filepath}`);
      }
    });

    window.localStorage.setItem(LOCALSTORAGE_FILEPATH, JSON.stringify(this.filepath));
  }

  public stopRecording(): void {
    this.mediaRecorder.stop();
    if (this.isRecording) {
      window.localStorage.removeItem(LOCALSTORAGE_ISRECORDING);
    }
    this.isRecording = false;
  }

  private async getBpmnStudioWindow(): Promise<Electron.DesktopCapturerSource> {
    const {desktopCapturer} = (window as any).nodeRequire('electron');
    const windowSources = await desktopCapturer.getSources({types: ['window', 'screen']});

    return windowSources.find((window) => {
      return window.name.includes('BPMN Studio');
    });
  }

  private handleUserMediaError = (error: Error): void => {
    console.error(`getUserMediaError: ${JSON.stringify(error, null, '---')}`);
  };

  private handleStream = (_stream: MediaStream): void => {
    this.recordedBlobs = [];
    const options = {mimeType: 'video/webm;codecs=vp9'};

    try {
      // eslint-disable-next-line @typescript-eslint/ban-ts-ignore
      // @ts-ignore
      this.mediaRecorder = new MediaRecorder(_stream, options);
    } catch (e) {
      console.error('Exception while creating MediaRecorder:', e);
      return;
    }

    this.mediaRecorder.ondataavailable = this.handleDataAvailable;
    this.mediaRecorder.start(10);
  };

  private handleDataAvailable = (event): void => {
    if (event.data && event.data.size > 0) {
      this.recordedBlobs.push(event.data);
    }
  };
}
