import {env} from '../../storage.mjs';
import {noteTemplateContent} from '../../note-templates.ts';
type Block={id:string;text:string;rev:number};
type Attachment={id:string;name:string;size:number;uploader:string};
type Doc={citationStyle?:string;html:string;body:string;tags:string;comments:{id:string;text:string;date:string}[];updatedAt:string};
type Version={citationStyle?:string;title:string;html?:string;body:string;tags:string;savedAt:string};
type ChatMessage={id:string;author:string;authorId:string;text:string;sentAt:string};
type Room={shareToken?:string;chat?:ChatMessage[];document?:Doc;versions?:Version[];docRev?:number;deletedAt?:string;files?:Attachment[];title:string;members:string[];blocks:Block[];rev:number};
const reply=(data:unknown,status=200)=>Response.json(data,{status,headers:{'Cache-Control':'no-store'}});
const idPattern=/^[0-9a-f-]{36}$/i;
const emailPattern=/^[^\s@]+@[^\s@]+\.[^\s@]+$/;
function identity(r:Request){return {id:r.headers.get('oai-authenticated-user-id'),email:r.headers.get('oai-authenticated-user-email')?.trim().toLowerCase()}}
async function read(id:string){return env.DB!.prepare("SELECT owner,data FROM records WHERE id=? AND kind='collaboration'").bind(id).first<{owner:string;data:string}>()}
function view(room:Room,id:string,owner:boolean,viewer:string){return {id,viewer,linkEnabled:owner&&!!room.shareToken,shareToken:owner?room.shareToken:undefined,chat:room.deletedAt?[]:(room.chat||[]).map(({authorId,...message})=>({...message,mine:authorId===viewer})),document:room.document,versions:room.versions||[],docRev:room.docRev||0,deleted:!!room.deletedAt,files:(room.files||[]).map(({id,name,size,uploader})=>({id,name,size,canRemove:owner||uploader===viewer})),title:room.title,rev:room.rev,blocks:room.blocks,isOwner:owner,members:owner?room.members:[]}}
export async function GET(r:Request){
  const u=identity(r);if(!u.id)return reply({error:'unauthorized'},401);
  const id=new URL(r.url).searchParams.get('room');
  if(!id){
    const {results}=await env.DB!.prepare("SELECT id,data,owner FROM records WHERE kind='collaboration' AND (owner=? OR EXISTS (SELECT 1 FROM json_each(records.data,'$.members') WHERE value=?))").bind(u.id,u.email||'').all<{id:string;data:string;owner:string}>();
    return reply(results.flatMap(row=>{const room=JSON.parse(row.data) as Room;return room.deletedAt&&row.owner!==u.id?[]:[{id:row.id,title:room.title,deleted:!!room.deletedAt,isOwner:row.owner===u.id}]}));
  }
  if(!idPattern.test(id))return reply({error:'missing'},404);
  const row=await read(id);if(!row)return reply({error:'missing'},404);
  const room=JSON.parse(row.data) as Room;const owner=row.owner===u.id;
  if(!owner&&(room.deletedAt||!u.email||!room.members.includes(u.email)))return reply({error:'missing'},404);
  return reply(view(room,id,owner,u.id));
}
export async function POST(r:Request){
  const u=identity(r);if(!u.id)return reply({error:'unauthorized'},401);
  if(!r.headers.get('content-type')?.toLowerCase().startsWith('application/json'))return reply({error:'invalid'},415);
  const raw=await r.text();if(raw.length>400000)return reply({error:'too_large'},413);
  let body;try{body=JSON.parse(raw)}catch{return reply({error:'invalid'},400)}
  if(!body||typeof body!=='object')return reply({error:'invalid'},400);
  if(body.action==='create'){
    const title=typeof body.title==='string'?body.title.trim():'';
    if(!title||title.length>120)return reply({error:'invalid'},400);
    const id=crypto.randomUUID();
    const room:Room={title,members:[],blocks:[{id:crypto.randomUUID(),text:'',rev:0}],rev:0};
    const content=noteTemplateContent(body.template,body.language);
    if(content.html)room.document={...content,tags:'',comments:[],updatedAt:new Date().toISOString()};
    await env.DB!.prepare("INSERT INTO records (id,owner,kind,data) VALUES (?,?,'collaboration',?)").bind(id,u.id,JSON.stringify(room)).run();
    return reply(view(room,id,true,u.id),201);
  }
  if(typeof body.room!=='string'||!idPattern.test(body.room))return reply({error:'invalid'},400);
  for(let i=0;i<6;i++){
    const row=await read(body.room);if(!row)return reply({error:'missing'},404);
    const room=JSON.parse(row.data) as Room;const owner=row.owner===u.id;
    const joining=body.action==='joinLink';
    if(joining){
      if(room.deletedAt||!room.shareToken||body.token!==room.shareToken)return reply({error:'missing'},404);
      if(owner||(u.email&&room.members.includes(u.email)))return reply(view(room,body.room,owner,u.id));
      if(!u.email||!emailPattern.test(u.email))return reply({error:'forbidden'},403);
    }else if(!owner&&(room.deletedAt||!u.email||!room.members.includes(u.email)))return reply({error:'missing'},404);
    if(body.action==='purge'){
      if(!owner)return reply({error:'forbidden'},403);
      if(!room.deletedAt)return reply({error:'not_in_trash'},409);
      const result=await env.DB!.prepare("DELETE FROM records WHERE id=? AND owner=? AND kind='collaboration' AND data=?").bind(body.room,u.id,row.data).run();
      if(result.meta.changes!==1)continue;
      const keys=(room.files||[]).map(f=>'collaboration/'+body.room+'/'+f.id);
      if(keys.length)try{await env.BUCKET!.delete(keys)}catch{console.error('Could not remove deleted collaboration attachments')}
      return reply({id:body.room});
    }
    let removed='';
    if(['rename','trash','restore'].includes(body.action)){
      if(!owner)return reply({error:'forbidden'},403);
      if(body.action==='trash')room.deletedAt=new Date().toISOString();
      else if(body.action==='restore')delete room.deletedAt;
      else {
        const title=typeof body.title==='string'?body.title.trim():'';
        if(room.deletedAt||!title||title.length>120)return reply({error:'invalid'},400);
        room.title=title;room.docRev=(room.docRev||0)+1;
      }
    }else if(room.deletedAt)return reply({error:'missing'},404);
    else if(joining){
      if(room.members.length>=30)return reply({error:'limit'},409);
      room.members.push(u.email!);
    }else if(body.action==='enableLink'||body.action==='disableLink'){
      if(!owner)return reply({error:'forbidden'},403);
      if(body.action==='enableLink')room.shareToken??=crypto.randomUUID();
      else delete room.shareToken;
    }else if(body.action==='chat'){
      const message=typeof body.text==='string'?body.text.trim():'';
      if(!message||message.length>1000||typeof body.messageId!=='string'||!idPattern.test(body.messageId))return reply({error:'invalid'},400);
      if(room.chat?.some(m=>m.id===body.messageId&&m.authorId===u.id))return reply(view(room,body.room,owner,u.id));
      let name=r.headers.get('oai-authenticated-user-full-name')||'';
      if(r.headers.get('oai-authenticated-user-full-name-encoding')==='percent-encoded-utf-8'){
        try{name=decodeURIComponent(name)}catch{name=''}
      }
      const author=(name.trim()||u.email?.split('@')[0]||'Member').slice(0,80);
      room.chat=[...(room.chat||[]),{id:body.messageId,authorId:u.id,author,text:message,sentAt:new Date().toISOString()}].slice(-100);
    }
    else if(body.action==='saveDocument'){
      if(body.base!==(room.docRev||0))return reply({error:'conflict',room:view(room,body.room,owner,u.id)},409);
      const d=body.document;
      if(!d||typeof d.html!=='string'||typeof d.body!=='string'||typeof d.tags!=='string'||typeof d.title!=='string'||!d.title.trim()||d.title.length>120||d.html.length>160000||d.body.length>120000||d.tags.length>1000||!Array.isArray(d.comments)||d.comments.length>100)return reply({error:'invalid'},400);
      const comments:Doc['comments']=[];
      for(const c of d.comments){
        if(!c||typeof c.id!=='string'||c.id.length>80||typeof c.text!=='string'||c.text.length>3000||typeof c.date!=='string'||c.date.length>40)return reply({error:'invalid'},400);
        comments.push({id:c.id,text:c.text,date:c.date});
      }
      const current=room.document;
      if(!current||current.html!==d.html||current.tags!==d.tags||current.citationStyle!==d.citationStyle||room.title!==d.title){
        const previous={title:room.title,citationStyle:current?.citationStyle,html:current?.html,body:current?.body??room.blocks.map(b=>b.text).join('\n\n'),tags:current?.tags||'',savedAt:current?.updatedAt||new Date().toISOString()};
        const versions=[previous,...(room.versions||[])].slice(0,12);
        while(versions.length&&new TextEncoder().encode(JSON.stringify(versions)).length>700000)versions.pop();
        room.versions=versions;
      }
      room.document={citationStyle:d.citationStyle==='MLA 9'?'MLA 9':'APA 7',html:d.html,body:d.body,tags:d.tags,comments,updatedAt:new Date().toISOString()};
      room.title=d.title.trim();room.docRev=(room.docRev||0)+1;
    }
    else if(body.action==='removeFile'){
      const f=room.files?.find(f=>f.id===body.file);
      if(!f)return reply({error:'missing'},404);
      if(!owner&&f.uploader!==u.id)return reply({error:'forbidden'},403);
      room.files=room.files!.filter(x=>x.id!==f.id);
      removed=f.id;
    }else if(body.action==='invite'||body.action==='revoke'){
      if(!owner)return reply({error:'forbidden'},403);
      const email=typeof body.email==='string'?body.email.trim().toLowerCase():'';
      if(email.length>254||!emailPattern.test(email))return reply({error:'invalid'},400);
      if(body.action==='invite'){
        if(room.members.length>=30&&!room.members.includes(email))return reply({error:'limit'},400);
        if(!room.members.includes(email))room.members.push(email);
      }else room.members=room.members.filter(x=>x!==email);
    }else if(body.action==='add'){
      if(room.document)return reply({error:'conflict'},409);
      if(room.blocks.length>=100)return reply({error:'limit'},400);
      room.docRev=(room.docRev||0)+1;room.blocks.push({id:crypto.randomUUID(),text:'',rev:0});
    }else if(body.action==='edit'){
      if(room.document)return reply({error:'conflict'},409);
      const block=room.blocks.find(b=>b.id===body.block);
      if(!block)return reply({error:'conflict',room:view(room,body.room,owner,u.id)},409);
      if(block.rev!==body.rev)return reply({error:'conflict',room:view(room,body.room,owner,u.id)},409);
      {
        if(typeof body.text!=='string'||body.text.length>8000)return reply({error:'invalid'},400);
        block.text=body.text;block.rev++;room.docRev=(room.docRev||0)+1;
      }
    }else return reply({error:'invalid'},400);
    if(room.blocks.reduce((n,b)=>n+b.text.length,0)>250000)return reply({error:'limit'},413);
    room.rev++;
    const encoded=JSON.stringify(room);
    if(new TextEncoder().encode(encoded).length>1950000||new TextEncoder().encode(JSON.stringify({...room,chat:undefined})).length>1700000)return reply({error:'limit'},413);
    const result=await env.DB!.prepare("UPDATE records SET data=? WHERE id=? AND kind='collaboration' AND data=?").bind(encoded,body.room,row.data).run();
    if(result.meta.changes===1){
      if(removed)try{await env.BUCKET!.delete('collaboration/'+body.room+'/'+removed)}catch{}
      return reply(view(room,body.room,owner,u.id));
    }
  }
  return reply({error:'retry'},503);
}
