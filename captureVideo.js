const {desktopCapturer} = window.nodeRequire('electron');

let recorder;

let recordedBlobs = [];

const media = {
  video: {
    tag: 'video',
    type: 'video/x-matroska;codecs=avc1',
    ext: '.mp4',
  },
};

async function getSources() {
  const sources = await desktopCapturer.getSources({types: ['window', 'screen']});
  return sources;
}

window.getSources = getSources;

async function startRecording() {
  const windowSources = await getSources();
  console.log(windowSources);
  const bpmnStudioWindow = windowSources.find((window) => {
    return window.name.includes('BPMN Studio');
  });

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
    })
    .then(handleStream)
    .catch(getUserMediaError);

  function getUserMediaError(e) {
    console.log(`getUserMediaError: ${JSON.stringify(e, null, '---')}`);
  }
}

function handleStream(_stream) {
  recordedBlobs = [];
  let options = {mimeType: 'video/webm;codecs=vp9'};
  if (!MediaRecorder.isTypeSupported(options.mimeType)) {
    console.error(`${options.mimeType} is not Supported`);
    options = {mimeType: 'video/webm;codecs=vp8'};
    if (!MediaRecorder.isTypeSupported(options.mimeType)) {
      console.error(`${options.mimeType} is not Supported`);
      options = {mimeType: 'video/webm'};
      if (!MediaRecorder.isTypeSupported(options.mimeType)) {
        console.error(`${options.mimeType} is not Supported`);
        options = {mimeType: ''};
      }
    }
  }

  try {
    recorder = new MediaRecorder(_stream, options);
  } catch (e) {
    console.error('Exception while creating MediaRecorder:', e);
    return;
  }

  recorder.ondataavailable = handleDataAvailable;
  recorder.start(10);
  console.log('MediaRecorder started', recorder);
}

function handleDataAvailable(event) {
  console.log('handleDataAvailable', event);
  if (event.data && event.data.size > 0) {
    recordedBlobs.push(event.data);
  }
}

async function saveRecordedVideo() {
  recorder.stop();
  console.log('recordedBloobs', recordedBlobs);

  const blob = new Blob(recordedBlobs, {type: media.video.type});
  const arrayBuffer = await blob.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);

  const fs = window.nodeRequire('fs');

  fs.writeFile('test.webm', buffer, (err) => {
    if (err) {
      console.error(`Failed to save video ${err}`);
    } else {
      console.log('Saved video: ' + 'test.webm');
    }
  });
}

window.startRecording = startRecording;
window.saveRecordedVideo = saveRecordedVideo;
