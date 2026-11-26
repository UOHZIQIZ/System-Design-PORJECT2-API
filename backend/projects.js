import {randomUUID} from 'node:crypto';

const tagColors=new Set(['','red','orange','yellow','green','blue','purple']);

function validate(value){
  if(!value||typeof value!=='object'||Array.isArray(value))return;
  if(Object.hasOwn(value,'tagColor')&&!tagColors.has(value.tagColor))return;
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
  return {title,course,dueDate,status,...(Object.hasOwn(value,'tagColor')?{tagColor:value.tagColor}:{}),notes:notes.trim(),updatedAt:new Date().toISOString()};
}

const toProject=({_id,...fields})=>({id:_id,tagColor:'',...fields});
const notFound=()=>[404,{error:'Project not found.'}];

export function createProjectHandler(collection){
  return async function projects(method,id,body){
    if(method==='GET'){
      if(!id){
        const rows=(await collection.find().toArray()).map(toProject);
        rows.sort((a,b)=>Number(!a.dueDate)-Number(!b.dueDate)||
          a.dueDate.localeCompare(b.dueDate)||b.updatedAt.localeCompare(a.updatedAt));
        return [200,rows];
      }
      const row=await collection.findOne({_id:id});
      return row?[200,toProject(row)]:notFound();
    }
    if(method==='DELETE'){
      const result=await collection.deleteOne({_id:id});
      return result.deletedCount?[204]:notFound();
    }
    const fields=validate(body);
    if(!fields)return [400,{error:'Check the title, course, due date, status, color tag and notes.'}];
    if(method==='POST'){
      const row={_id:randomUUID(),tagColor:'',...fields};
      await collection.insertOne(row);
      return [201,toProject(row)];
    }
    const row=await collection.findOneAndUpdate({_id:id},{$set:fields},{returnDocument:'after'});
    return row?[200,toProject(row)]:notFound();
  };
}
