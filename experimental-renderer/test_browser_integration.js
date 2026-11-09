const t = makeCloudTimeline(10, [{start: 4, end: 9}, {start: 0, end: 3}],
  [{start: 5, end: 6}], [{start: 6.5, end: 7}], [], {text: 'hello'});
if (JSON.stringify(t.clips) !== JSON.stringify([{start:4,end:5},{start:6,end:9},{start:0,end:3}])) throw Error('incorrect clip order or pause removal');
if (t.zooms[0].start !== 1.5 || t.zooms[0].end !== 2) throw Error('incorrect zoom mapping');
if (t.graphics[0].end !== 3.5) throw Error('incorrect title timing');
print('Browser timeline mapping passed');
class FormData { append() {} }
class XMLHttpRequest {
  constructor() { this.upload = {}; this.status = 200; this.response = {size: 4000, type: 'video/mp4'}; }
  open(method, url) { if (method !== 'POST' || url !== 'https://example.test/render') throw Error('incorrect endpoint'); }
  send() { this.upload.onload(); this.onload(); }
}
let messages = [];
exportCloudVideo('https://example.test', {size: 100}, t, m => messages.push(m)).then(blob => {
  if (blob.size !== 4000 || messages.length !== 2) throw Error('export did not complete');
  print('Cloud export request passed');
});
