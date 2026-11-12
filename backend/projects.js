// Reuses the original API's SQLite and CRUD approach with a dedicated data model.
import {DatabaseSync} from 'node:sqlite';
import {mkdirSync,readFileSync} from 'node:fs';
import {join,resolve} from 'node:path';
import {randomUUID} from 'node:crypto';

const dir=resolve(process.env.DATA_DIR || '.data');
mkdirSync(dir,{recursive:true});
const db=new DatabaseSync(join(dir,'projects.sqlite'));
db.exec(readFileSync(new URL('./schema.sql',import.meta.url),'utf8'));
const list=db.prepare("SELECT * FROM projects ORDER BY dueDate='',dueDate,updatedAt DESC");
const get=db.prepare('SELECT * FROM projects WHERE id=?');
const insert=db.prepare('INSERT INTO projects VALUES (?,?,?,?,?,?,?)');
const update=db.prepare('UPDATE projects SET title=?,course=?,dueDate=?,status=?,notes=?,updatedAt=? WHERE id=?');
const remove=db.prepare('DELETE FROM projects WHERE id=?');

function validate(value){
  if(!value||typeof value!=='object'||Array.isArray(value))return;
  const title=typeof value.title==='string'?value.title.trim():'';
  const course=typeof value.course==='string'?value.course.trim():'';
  const {dueDate='',status='planned',notes=''}=value;
  if(!title||title.length>120||!course||course.length>80||typeof notes!=='string'||notes.length>1500)return;
  if(!['planned','in-progress','completed'].includes(status)||typeof dueDate!=='string')return;
  if(dueDate){
    if(!/^\d{4}-\d{2}-\d{2}$/.test(dueDate))return;
    const date=new Date(dueDate+'T00:00:00Z');
    if(!Number.isFinite(+date)||date.toISOString().slice(0,10)!==dueDate)return;
  }
  return [title,course,dueDate,status,notes.trim(),new Date().toISOString()];
}
export function projects(method,id,body){
  if(method==='GET'){
    if(!id)return [200,list.all()];
    const row=get.get(id);
    return row?[200,row]:[404,{error:'Project not found.'}];
  }
  if(method==='DELETE')return remove.run(id).changes?[204]:[404,{error:'Project not found.'}];
  const fields=validate(body);
  if(!fields)return [400,{error:'Check the title, course, due date, status and notes.'}];
  if(method==='POST'){
    id=randomUUID();
    insert.run(id,...fields);
    return [201,get.get(id)];
  }
  return update.run(...fields,id).changes?[200,get.get(id)]:[404,{error:'Project not found.'}];
}
