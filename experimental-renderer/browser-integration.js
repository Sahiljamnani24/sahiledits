/* Prototype integration snippet. Insert into the website only after the service is deployed and tested. */
function makeCloudTimeline(duration, selectedClips, removedPauses, zooms, words, title) {
  const selected = selectedClips.length ? selectedClips : [{start: 0, end: duration}];
  const pauses = removedPauses.slice().sort((a, b) => a.start - b.start);
  const clips = [];
  for (const clip of selected) {
    let cursor = clip.start;
    for (const pause of pauses) {
      if (pause.end <= cursor || pause.start >= clip.end) continue;
      if (pause.start - cursor >= .08) clips.push({start: cursor, end: Math.min(pause.start, clip.end)});
      cursor = Math.max(cursor, pause.end);
      if (cursor >= clip.end) break;
    }
    if (clip.end - cursor >= .08) clips.push({start: cursor, end: clip.end});
  }
  if (!clips.length || clips.length > 50) throw Error('This edit has too many cuts to export.');
  let offset = 0;
  const outputZooms = [];
  for (const clip of clips) {
    for (const zoom of zooms) {
      const left = Math.max(clip.start, zoom.start), right = Math.min(clip.end, zoom.end);
      if (right > left) outputZooms.push({start: offset + left - clip.start, end: offset + right - clip.start, scale: 1.12});
    }
    offset += clip.end - clip.start;
  }
  const graphics = title && title.text ? [{start: 0, end: Math.min(3.5, offset), text: title.text}] : [];
  return {clips, words, zooms: outputZooms, graphics};
}

function exportCloudVideo(url, selectedFile, timeline, onStatus) {
  if (!selectedFile || selectedFile.size > 24 * 1024 * 1024) {
    return Promise.reject(Error('Cloud export currently supports videos up to 24 MB.'));
  }
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest(), form = new FormData();
    form.append('video', selectedFile);
    form.append('timeline', JSON.stringify(timeline));
    xhr.open('POST', url + '/render');
    xhr.responseType = 'blob';
    xhr.timeout = 360000;
    xhr.upload.onprogress = event => {
      if (event.lengthComputable) onStatus('Uploading video: ' + Math.round(event.loaded / event.total * 100) + '%');
    };
    xhr.upload.onload = () => onStatus('Video uploaded. Rendering the edit on the server…');
    xhr.onload = async () => {
      if (xhr.status !== 200) {
        try { reject(Error(JSON.parse(await xhr.response.text()).error || 'The server could not render this video.')); }
        catch (_) { reject(Error('The server could not render this video.')); }
        return;
      }
      if (!xhr.response || xhr.response.size < 1000 || !xhr.response.type.startsWith('video/')) {
        reject(Error('The server returned an invalid video.'));
        return;
      }
      onStatus('Render complete. Downloading MP4…');
      resolve(xhr.response);
    };
    xhr.onerror = () => reject(Error('The connection to the renderer was lost.'));
    xhr.ontimeout = () => reject(Error('Rendering timed out.'));
    xhr.send(form);
  });
}
