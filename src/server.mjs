import {createServer} from 'node:http';
import {Readable} from 'node:stream';
import {pipeline} from 'node:stream/promises';
import * as records from './api/records/route.ts';
import * as images from './api/images/route.ts';
import * as collaboration from './api/collaboration/route.ts';
import * as files from './api/collaboration/files/route.ts';
import * as doi from './api/citations/doi/route.ts';

const routes=new Map([
  ['/api/records',records],
  ['/api/images',images],
  ['/api/collaboration',collaboration],
  ['/api/collaboration/files',files],
  ['/api/citations/doi',doi],
]);
const port=Number(process.env.PORT||3000);
const host='127.0.0.1';
const origin='http://'+host+':'+port;
const users=new Set(['student','teammate','outsider']);
const maxBody=9*1024*1024;

createServer(async(req,res)=>{
  const json=(status,error)=>{res.writeHead(status,{'Content-Type':'application/json','Cache-Control':'no-store'});res.end(JSON.stringify({error}))};
  try{
    if(![host+':'+port,'localhost:'+port].includes(req.headers.host))return json(403,'local_only');
    const url=new URL(req.url,origin);
    if(url.origin!==origin)return json(403,'local_only');
    const route=routes.get(url.pathname);
    if(!route)return json(404,'not_found');
    if(!Object.hasOwn(route,req.method)){res.setHeader('Allow',Object.keys(route).join(', '));return json(405,'method_not_allowed')}
    const headers=new Headers(req.headers);
    // Rebuild identity from explicit local test accounts; never trust forwarded site headers.
    for(const name of [...headers.keys()])if(name.startsWith('oai-authenticated-'))headers.delete(name);
    const user=headers.get('x-demo-user');
    if(!users.has(user))return json(401,'Set X-Demo-User to student, teammate or outsider');
    headers.set('oai-authenticated-user-id',user);
    headers.set('oai-authenticated-user-email',user+'@example.test');
    if(headers.has('origin')&&headers.get('origin')!==origin)return json(403,'invalid_origin');
    if(Number(headers.get('content-length')||0)>maxBody)return json(413,'too_large');
    const chunks=[];let length=0;
    for await(const chunk of req){
      length+=chunk.length;
      if(length>maxBody){json(413,'too_large');return}
      chunks.push(chunk);
    }
    const body=chunks.length?Buffer.concat(chunks):undefined;
    const response=await route[req.method](new Request(url,{method:req.method,headers,body}));
    res.writeHead(response.status,Object.fromEntries(response.headers));
    if(response.body)await pipeline(Readable.fromWeb(response.body),res);
    else res.end();
  }catch(error){
    if(res.headersSent){res.destroy();return}
    if(error instanceof SyntaxError||error instanceof TypeError)return json(400,'invalid_request');
    console.error(error);
    json(500,'internal_error');
  }
}).listen(port,host,()=>console.log('Study Studio API listening at '+origin));
