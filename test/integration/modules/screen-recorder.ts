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

export class ScreenRecorder {
  private mediaRecorder: any;
  private recordedBlobs: Array<Blob> = [];

  constructor() {
    exposeFunctionForTesting('startRecording', () => {
      this.startRecording();
    });

    exposeFunctionForTesting('stopRecording', () => {
      this.stopRecording();
    });

    exposeFunctionForTesting('stopRecordingAndSave', (filename: string) => {
      this.stopRecordingAndSave(filename);
    });
  }

  /**
   * Records the BPMN Studio window
   */
  public async startRecording(): Promise<void> {
    const bpmnStudioWindow = await this.getBpmnStudioWindow();

    console.log(bpmnStudioWindow);

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

  public async stopRecordingAndSave(filepath: string): Promise<void> {
    this.mediaRecorder.stop();

    const blob = new Blob(this.recordedBlobs, {type: media.video.type});
    const arrayBuffer = await (blob as any).arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    if (!fs.existsSync(filepath)) {
      fs.mkdirSync(path.dirname(filepath), {recursive: true});
    }

    fs.writeFile(filepath, buffer, (error) => {
      if (error) {
        console.error(`Failed to save video ${error}`);
      } else {
        console.log(`Saved video: ${filepath}`);
      }
    });
  }

  public stopRecording(): void {
    this.mediaRecorder.stop();
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
