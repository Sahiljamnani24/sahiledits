// Video analysis via Gemini Files. Provider keys remain on the server.
const cors={'Access-Control-Allow-Origin':'*','Access-Control-Allow-Headers':'apikey, content-type, x-video-size, x-analysis-kind','Access-Control-Allow-Methods':'POST, OPTIONS','Content-Type':'application/json'};
const result=(body,status=200)=>new Response(JSON.stringify(body),{status,headers:cors});
const base='https://generativelanguage.googleapis.com';
Deno.serve(async req=>{
  if(req.method==='OPTIONS')return new Response('ok',{headers:cors});
  if(req.method!=='POST')return result({error:'Method not allowed'},405);
  let keys;try{keys=Object.values(JSON.parse(Deno.env.get('SUPABASE_PUBLISHABLE_KEYS')||'{}'))}catch{return result({error:'App is not configured'},503)}
  if(!keys.includes(req.headers.get('apikey')))return result({error:'Invalid app key'},401);
  const key=Deno.env.get('GEMINI_API_KEY'),project=Deno.env.get('SUPABASE_URL'),service=Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if(!key||!project||!service)return result({error:'Analysis service is not configured'},503);
  const size=Number(req.headers.get('x-video-size')),mime=(req.headers.get('content-type')||'').split(';')[0].toLowerCase(),kind=req.headers.get('x-analysis-kind');
  if(!Number.isInteger(size)||size<1||size>50*1024*1024||!['video/mp4','video/webm','video/quicktime'].includes(mime)||!['footage','reference'].includes(kind))return result({error:'Choose an MP4, MOV, or WebM up to 50 MB'},400);
  let fileName='';
  try{
    const quota=await fetch(project+'/rest/v1/rpc/reserve_sahil_ai_call',{method:'POST',headers:{apikey:service,Authorization:'Bearer '+service,'Content-Type':'application/json'},body:'{}'});
    if(!quota.ok)return result({error:'Usage limit is unavailable'},503);
    if(await quota.json()!==true)return result({error:'The shared daily test limit has been reached.'},429);
    if(!req.body)return result({error:'Video upload was empty'},400);
    const bytes=new Uint8Array(size);let offset=0;const reader=req.body.getReader();
    while(true){const {done,value}=await reader.read();if(done)break;if(offset+value.length>size){await reader.cancel();return result({error:'Video exceeds its stated size'},413)}bytes.set(value,offset);offset+=value.length}
    if(offset!==size)return result({error:'Video upload was incomplete'},400);
    const initial=await fetch(base+'/upload/v1beta/files',{method:'POST',headers:{'x-goog-api-key':key,'X-Goog-Upload-Protocol':'resumable','X-Goog-Upload-Command':'start','X-Goog-Upload-Header-Content-Length':String(size),'X-Goog-Upload-Header-Content-Type':mime,'Content-Type':'application/json'},body:JSON.stringify({file:{display_name:'SahilEdits '+kind}})});
    if(!initial.ok)throw Error('upload start');
    const upload=initial.headers.get('x-goog-upload-url');const url=new URL(upload||'');
    if(url.protocol!=='https:'||!(url.hostname==='googleapis.com'||url.hostname.endsWith('.googleapis.com')))throw Error('invalid upload endpoint');
    const uploaded=await fetch(url,{method:'POST',headers:{'Content-Length':String(size),'X-Goog-Upload-Offset':'0','X-Goog-Upload-Command':'upload, finalize'},body:bytes});
    if(!uploaded.ok)throw Error('upload failed');
    let file=(await uploaded.json()).file;
    if(!/^files\/[a-z0-9-]+$/.test(file?.name||''))throw Error('invalid file');fileName=file.name;
    for(let attempt=0;file.state==='PROCESSING'&&attempt<20;attempt++){
      await new Promise(resolve=>setTimeout(resolve,3000));
      const check=await fetch(base+'/v1beta/'+fileName,{headers:{'x-goog-api-key':key}});if(!check.ok)throw Error('processing failed');file=await check.json();
    }
    if(file.state!=='ACTIVE'||typeof file.uri!=='string')throw Error('video not ready');
    const prompt=kind==='reference'?'Describe this reference video for an editor: caption typography, colors, placement, motion, pacing, transitions, zooms, graphics, music mood and approximate timestamps. Distinguish observations from uncertainty. Do not reproduce copyrighted audio.':'Analyze this source video for a short-form editor. Describe the content, noteworthy visual and spoken moments with timestamps, possible hooks, speakers, framing and moments suitable for cuts, captions, zooms or graphics. Do not invent details.';
    const analyzed=await fetch(base+'/v1beta/models/gemini-3.8-flash:generateContent',{method:'POST',headers:{'x-goog-api-key':key,'Content-Type':'application/json'},body:JSON.stringify({contents:[{parts:[{file_data:{mime_type:mime,file_uri:file.uri}},{text:prompt}]}],generationConfig:{maxOutputTokens:8192}})});
    if(!analyzed.ok)throw Error('analysis failed');
    const json=await analyzed.json();const text=json?.candidates?.[0]?.content?.parts?.filter(p=>typeof p.text==='string'&&!p.thought).map(p=>p.text).join('');
    if(!text)throw Error('empty analysis');
    return result({analysis:text.slice(0,12000)});
  }catch{return result({error:'Video analysis did not finish. Please try again.'},502)}
  finally{if(fileName){try{await fetch(base+'/v1beta/'+fileName,{method:'DELETE',headers:{'x-goog-api-key':key}})}catch{}}}
});
