import {createServer} from 'node:http';
import {readFile} from 'node:fs/promises';
import {createProjectHandler} from './projects.js';
import {connectDatabase} from './database.js';

const {client,collection}=await connectDatabase().catch(error=>{
  console.error(error.message);
  process.exit(1);
});
const projects=createProjectHandler(collection);

const files=new Map([['/',['index.html','text/html']],['/styles.css',['styles.css','text/css']],['/app.js',['app.js','text/javascript']]]);
const port=Number(process.env.PORT||3000);
const host=process.env.HOST||'127.0.0.1';
const send=(res,status,data,headers={})=>{
  res.writeHead(status,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store','X-Content-Type-Options':'nosniff',...headers});
  res.end(data===undefined?undefined:JSON.stringify(data));
};
const server=createServer(async(req,res)=>{
  try{
    const pathname=new URL(req.url,'http://localhost').pathname;
    const asset=files.get(pathname);
    if(asset&&req.method==='GET'){
      const bytes=await readFile(new URL('../frontend/'+asset[0],import.meta.url));
      res.writeHead(200,{'Content-Type':asset[1]+'; charset=utf-8','X-Content-Type-Options':'nosniff'});
      return res.end(bytes);
    }
    const match=/^\/api\/projects(?:\/([0-9a-f-]{36}))?$/.exec(pathname);
    if(!match)return send(res,404,{error:'Not found.'});
    const id=match[1];
    const allowed=id?['GET','PUT','DELETE']:['GET','POST'];
    if(!allowed.includes(req.method))return send(res,405,{error:'Method not allowed.'},{Allow:allowed.join(', ')});
    let body;
    if(['POST','PUT'].includes(req.method)){
      if(req.headers['content-type']?.split(';')[0].trim().toLowerCase()!=='application/json')return send(res,415,{error:'Send an application/json body.'});
      const chunks=[];let bytes=0;
      for await(const chunk of req){
        bytes+=chunk.length;
        if(bytes>32768){send(res,413,{error:'Request is too large.'});return}
        chunks.push(chunk);
      }
      try{body=JSON.parse(Buffer.concat(chunks).toString('utf8'))}
      catch{return send(res,400,{error:'Invalid JSON.'})}
    }
    if(req.method==='DELETE'&&req.headers['sec-fetch-site']==='cross-site')return send(res,403,{error:'Cross-site requests are not allowed.'});
    send(res,...await projects(req.method,id,body));
  }catch(error){
    console.error('Request failed:',error.name);
    if(!res.headersSent)send(res,500,{error:'The server could not complete your request.'});
    else res.destroy();
  }
}).listen(port,host,()=>console.log('Project Record: http://'+host+':'+port));

for(const signal of ['SIGINT','SIGTERM']){
  process.once(signal,()=>server.close(()=>{void client.close();}));
}
