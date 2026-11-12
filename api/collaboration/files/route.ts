import {env} from '../../../storage.mjs';

type Attachment={id:string;name:string;size:number;uploader:string;mime?:string};
type Room={members:string[];deletedAt?:string;rev:number;files?:Attachment[]};
const imageTypes=new Set(['image/png','image/jpeg','image/webp','image/gif']);
const max=8*1024*1024;
const valid=(value:string)=>/^[0-9a-f-]{36}$/i.test(value);
const error=(status:number)=>Response.json({ok:false},{status,headers:{'Cache-Control':'no-store'}});
async function lookup(req:Request,id:string){
  const user=req.headers.get('oai-authenticated-user-id');
  if(!user||!valid(id))return null;
  const row=await env.DB!.prepare("SELECT owner,data FROM records WHERE id=? AND kind='collaboration'").bind(id).first<{owner:string;data:string}>();
  if(!row)return null;
  const room=JSON.parse(row.data) as Room;
  const email=req.headers.get('oai-authenticated-user-email')?.trim().toLowerCase();
  if(room.deletedAt||(row.owner!==user&&(!email||!room.members.includes(email))))return null;
  return {user,room,original:row.data};
}
export async function GET(req:Request){
  const params=new URL(req.url).searchParams;
  const roomId=params.get('room')||'',fileId=params.get('file')||'';
  if(!valid(fileId))return error(404);
  const access=await lookup(req,roomId);
  const file=access?.room.files?.find(f=>f.id===fileId);
  if(!file)return error(404);
  const object=await env.BUCKET!.get('collaboration/'+roomId+'/'+fileId);
  if(!object)return error(404);
  if(params.get('inline')==='1'&&file.mime&&imageTypes.has(file.mime))return new Response(object.body,{headers:{'Content-Type':file.mime,'X-Content-Type-Options':'nosniff','Cache-Control':'private, no-store'}});
  return new Response(object.body,{headers:{
    'Content-Type':'application/octet-stream',
    'Content-Disposition':"attachment; filename*=UTF-8''"+encodeURIComponent(file.name).replace(/['()*]/g,c=>'%'+c.charCodeAt(0).toString(16)),
    'X-Content-Type-Options':'nosniff','Cache-Control':'private, no-store'
  }});
}
export async function POST(req:Request){
  const roomId=new URL(req.url).searchParams.get('room')||'';
  const origin=req.headers.get('origin');
  if(origin!==new URL(req.url).origin)return error(403);
  const initial=await lookup(req,roomId);
  if(!initial)return error(404);
  if((initial.room.files?.length||0)>=30)return error(409);
  if(Number(req.headers.get('content-length')||0)>max+16384)return error(413);
  let value:FormDataEntryValue|null;
  try{value=(await req.formData()).get('file')}catch{return error(400)}
  if(!(value instanceof File)||!value.size||value.size>max)return error(413);
  const name=Array.from(value.name.replace(/[\u0000-\u001f\u007f]/g,'').trim()).slice(0,160).join('')||'attachment';
  const file={id:crypto.randomUUID(),name,size:value.size,uploader:initial.user,mime:imageTypes.has(value.type)?value.type:undefined};
  const key='collaboration/'+roomId+'/'+file.id;
  let linked=false;
  try{
    await env.BUCKET!.put(key,await value.arrayBuffer());
    for(let i=0;i<6;i++){
      const access=await lookup(req,roomId);
      if(!access)return error(404);
      if((access.room.files?.length||0)>=30)return error(409);
      access.room.files=[...(access.room.files||[]),file];access.room.rev++;
      const result=await env.DB!.prepare("UPDATE records SET data=? WHERE id=? AND kind='collaboration' AND data=?").bind(JSON.stringify(access.room),roomId,access.original).run();
      if(result.meta.changes===1){linked=true;return Response.json({ok:true,url:'/api/collaboration/files?room='+roomId+'&file='+file.id+'&inline=1'},{status:201})}
    }
    return error(503);
  }finally{if(!linked)try{await env.BUCKET!.delete(key)}catch{}}
}
