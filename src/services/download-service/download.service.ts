// download.js v4.21, by dandavis; 2008-2018. [MIT] see http://danml.com/download.html for tests/usage
// v1 landed a FF+Chrome compatible way of downloading strings to local un-named files, upgraded to use a hidden frame and optional mime
// v2 added named files via a[download], msSaveBlob, IE (10+) support, and window.URL support for larger+faster saves than dataURLs
// v3 added dataURL and Blob Input, bind-toggle arity, and legacy dataURL fallback was improved with force-download mime and base64 support. 3.1 improved safari handling.
// v4 adds AMD/UMD, commonJS, and plain browser support
// v4.1 adds url download capability via solo URL argument (same domain/CORS only)
// v4.2 adds semantic variable names, long (over 2MB) dataURL support, and hidden by default temp anchors
// https://github.com/rndme/download

export function download(data, strFileName, strMimeType): XMLHttpRequest | boolean {
  const defaultMime = 'application/octet-stream'; // this default mime also triggers iframe downloads
  const anchor = document.createElement('a');
  let mimeType = strMimeType || defaultMime;
  let payload = data;
  let url = !strFileName && !strMimeType && payload;
  let fileName = strFileName || 'download';
  let reader;

  if (String(this) === 'true') {
    // reverse arguments, allowing download.bind(true, "text/xml", "export.xml") to act as a callback
    payload = [payload, mimeType];
    mimeType = payload[0];
    payload = payload[1];
  }

  if (url && url.length < 2048) {
    // if no filename and no mime, assume a url was passed as the only argument
    fileName = url
      .split('/')
      .pop()
      .split('?')[0];

    anchor.href = url; // assign href prop to temp anchor

    if (anchor.href.indexOf(url) !== -1) {
      // if the browser determines that it's a potentially valid url path:
      const ajax = new XMLHttpRequest();

      ajax.open('GET', url, true);
      ajax.responseType = 'blob';
      ajax.onload = (e: any): void => {
        download(e.target.response, fileName, defaultMime);
      };

      setTimeout(() => {
        ajax.send();
      }, 0); // allows setting custom ajax headers using the return:

      return ajax;
    } // end if valid url?
  } // end if url?

  // go ahead and download dataURLs right away
  if (/^data:([\w+-]+\/[\w+.-]+)?[,;]/.test(payload)) {
    if (payload.length > 1024 * 1024 * 1.999) {
      payload = dataUrlToBlob(payload);
      mimeType = payload.type || defaultMime;
    } else {
      return navigator.msSaveBlob // IE10 can't do a[download], only Blobs:
        ? navigator.msSaveBlob(dataUrlToBlob(payload), fileName)
        : saver(payload, false); // everyone else can save dataURLs un-processed
    }
  } else if (/([\x80-\xff])/.test(payload)) {
    // not data url, is it a string with special needs?
    payload = new Blob([payload], {type: mimeType});
  }

  const blob = payload instanceof Blob ? payload : new Blob([payload], {type: mimeType});

  function dataUrlToBlob(strUrl): Blob {
    const parts = strUrl.split(/[:;,]/);
    const indexDecoder = strUrl.indexOf('charset') > 0 ? 3 : 2;
    const decoder = parts[indexDecoder] == 'base64' ? atob : decodeURIComponent;

    const binData = decoder(parts.pop());
    const type = parts[1];

    return new Blob([binData], {type: type});
  }

  function saver(saveUrl, winMode): boolean {
    if ('download' in anchor) {
      const anchorClickHandler = (event): void => {
        event.stopPropagation();

        anchor.removeEventListener('click', anchorClickHandler);
      };

      // html5 A[download]
      anchor.href = saveUrl;
      anchor.setAttribute('download', fileName);
      anchor.className = 'download-js-link';
      anchor.innerHTML = 'downloading...';
      anchor.style.display = 'none';
      anchor.addEventListener('click', anchorClickHandler);

      document.body.appendChild(anchor);

      setTimeout(() => {
        anchor.click();

        document.body.removeChild(anchor);

        if (winMode) {
          setTimeout(() => {
            URL.revokeObjectURL(anchor.href);
          }, 250);
        }
      }, 66);

      return true;
    }

    // handle non-a[download] safari as best we can:
    if (/(Version)\/(\d+)\.(\d+)(?:\.(\d+))?.*Safari\//.test(navigator.userAgent)) {
      if (/^data:/.test(url)) {
        saveUrl = `data:${url.replace(/^data:([\w/\-+]+)/, defaultMime)}`;
      }

      if (!window.open(url)) {
        // popup blocked, offer direct download:
        // eslint-disable-next-line no-restricted-globals, no-alert
        if (confirm('Displaying New Document\n\nUse Save As... to download, then click back to return to this page.')) {
          // eslint-disable-next-line no-restricted-globals
          location.href = saveUrl;
        }
      }

      return true;
    }

    // do iframe dataURL download (old ch+FF):
    const downloadIframe = document.createElement('iframe');
    document.body.appendChild(downloadIframe);

    if (!winMode && /^data:/.test(url)) {
      // force a mime that will download:
      url = `data:${url.replace(/^data:([\w/\-+]+)/, defaultMime)}`;
    }

    downloadIframe.src = url;

    setTimeout(() => {
      document.body.removeChild(downloadIframe);
    }, 333);

    return false;
  } // end saver

  if (navigator.msSaveBlob) {
    // IE10+ : (has Blob, but not a[download] or URL)
    return navigator.msSaveBlob(blob, fileName);
  }

  if (URL) {
    // simple fast and modern way using Blob and URL:
    saver(URL.createObjectURL(blob), true);
  } else {
    // Blob but not URL support:
    reader = new FileReader();

    reader.onload = (): void => {
      saver(this.result, false);
    };

    reader.readAsDataURL(blob);
  }

  return true;
}
