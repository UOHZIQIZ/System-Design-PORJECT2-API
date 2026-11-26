const dateAt = n => {const d=new Date();d.setDate(d.getDate()+n);return [d.getFullYear(),String(d.getMonth()+1).padStart(2,'0'),String(d.getDate()).padStart(2,'0')].join('-')};
const tagsKey='pr-workspace-preview-tags-v1';
const read=(key,fallback)=>{try{return JSON.parse(localStorage.getItem(key))??fallback}catch{return fallback}};
const write=(key,value)=>{try{localStorage.setItem(key,JSON.stringify(value))}catch{}};
let tagNames=read(tagsKey,{});
const form=document.querySelector('#project-form');
document.querySelector('#new-project').addEventListener('click',()=>form.elements.namedItem('title').focus({preventScroll:true}));
const list=document.querySelector('#projects');
const notice=document.querySelector('#notice');
const filter=document.querySelector('#filter');
const tagFilter=document.querySelector('#tag-filter');
const save=document.querySelector('#save');
const cancel=document.querySelector('#cancel');
const heading=document.querySelector('#form-title');
const labels={planned:'Planned','in-progress':'In progress',completed:'Completed'};
let items=[],editing='',busy=false,loaded=false;

async function api(path='',method='GET',body){
  const res=await fetch('/api/projects'+path,{method,headers:body?{'Content-Type':'application/json'}:undefined,body:body?JSON.stringify(body):undefined});
  const data=res.status===204?null:await res.json();
  if(!res.ok)throw new Error(data?.error||'Request failed.');
  return data;
}
function el(tag,text,cls){
  const element=document.createElement(tag);
  if(text)element.textContent=text;
  if(cls)element.className=cls;
  return element;
}
let archived=false;
const openTasks=new Set();
const tagSelects=[tagFilter,form.elements.namedItem('tagColor')];
const colorOptions=[...tagSelects[1].options].slice(1);
const nameFor=color=>tagNames[color]||color[0].toUpperCase()+color.slice(1);
function updateTagOptions(){
  for(const select of tagSelects)for(const option of select.options){
    if(colorOptions.some(c=>c.value===option.value))option.textContent=nameFor(option.value);
  }
}
const dialog=document.querySelector('#tag-dialog');
document.querySelector('#tag-settings').onclick=()=>{
  const fields=document.querySelector('#tag-fields');
  fields.replaceChildren();
  for(const {value:color} of colorOptions){
    const label=el('label',color[0].toUpperCase()+color.slice(1));
    const input=el('input');input.name=color;input.maxLength=32;input.value=tagNames[color]||'';input.placeholder=nameFor(color);
    label.append(input);fields.append(label);
  }
  dialog.returnValue='';dialog.showModal();
};
dialog.addEventListener('close',()=>{
  if(dialog.returnValue!=='save')return;
  tagNames=Object.fromEntries([...new FormData(dialog.querySelector('form'))].map(([key,value])=>[key,value.trim()]));
  write(tagsKey,tagNames);updateTagOptions();render();
});
for(const [id,value] of [['active-view',false],['archive-view',true]]){
  document.querySelector('#'+id).onclick=()=>{
    archived=value;
    for(const [key,selected] of [['active-view',!value],['archive-view',value]]){
      const button=document.querySelector('#'+key);
      button.setAttribute('aria-pressed',selected);
      button.classList.toggle('secondary',!selected);
    }
    render();
  };
}
async function saveExtra(item,changes){
  await perform(async()=>{
    const updated=await api('/'+item.id,'PUT',{...item,...changes});
    items=items.map(row=>row.id===item.id?updated:row);
    notice.textContent='';
  });
}
function checklist(item){
  const tasks=item.tasks||[];
  const details=el('details',null,'checklist');
  details.open=openTasks.has(item.id);
  details.ontoggle=()=>{if(details.isConnected){if(details.open)openTasks.add(item.id);else openTasks.delete(item.id)}};
  details.append(el('summary','Tasks · '+tasks.filter(t=>t.done).length+'/'+tasks.length+' complete'));
  for(const [index,task] of tasks.entries()){
    const line=el('div',null,'task-line');
    const label=el('label',task.title);const check=el('input');check.type='checkbox';check.checked=task.done;check.disabled=busy;
    check.onchange=()=>saveExtra(item,{tasks:tasks.map((t,i)=>i===index?{...t,done:check.checked}:t)});
    label.prepend(check);
    const remove=el('button','Remove','secondary');remove.type='button';remove.disabled=busy;
    remove.setAttribute('aria-label','Remove task: '+task.title);
    remove.onclick=()=>saveExtra(item,{tasks:tasks.filter((_,i)=>i!==index)});
    line.append(label,remove);details.append(line);
  }
  const add=el('form',null,'task-add');const input=el('input');input.placeholder='Add a task…';input.setAttribute('aria-label','New task');input.required=true;input.maxLength=100;
  const button=el('button','Add task');button.disabled=busy;
  add.append(input,button);
  add.onsubmit=e=>{e.preventDefault();if(tasks.length>=50){notice.textContent='A project can have up to 50 tasks.';return}if(input.value.trim())saveExtra(item,{tasks:[...tasks,{title:input.value.trim(),done:false}]})};
  details.append(add);return details;
}
function render(){
  const upcoming=document.querySelector('#upcoming');
  upcoming.replaceChildren();
  const due=items.filter(row=>!row.archived&&row.status!=='completed'&&row.dueDate).sort((a,b)=>a.dueDate.localeCompare(b.dueDate));
  for(const [label,match] of [['Overdue',d=>d<dateAt(0)],['Next 7 days',d=>d>=dateAt(0)&&d<=dateAt(7)],['Later',d=>d>dateAt(7)]]){
    const group=el('div',null,'deadline-group');
    group.append(el('strong',label));
    const rows=due.filter(row=>match(row.dueDate));
    for(const row of rows)group.append(el('p',row.title+' · '+row.dueDate));
    if(!rows.length)group.append(el('p','No deadlines'));
    upcoming.append(group);
  }
  const visible=items.filter(item=>Boolean(item.archived)===archived&&(!filter.value||item.status===filter.value)&&(!tagFilter.value||(item.tagColor||'untagged')===tagFilter.value));
  for(const [key,value] of Object.entries({total:items.length,progress:items.filter(item=>item.status==='in-progress').length,complete:items.filter(item=>item.status==='completed').length})){
    document.querySelector('#'+key+'-count').textContent=loaded?value:'—';
  }
  list.replaceChildren();
  if(loaded&&!visible.length){list.append(el('li',(filter.value||tagFilter.value)?'No projects match this filter.':'No projects in this view.'));return}
  for(const item of visible){
    const row=el('li',null,'project-card');
    const top=el('div',null,'project-top');
    const badge=el('span',labels[item.status]||'Unknown status','badge');
    badge.dataset.status=item.status;
    top.append(el('h3',item.title),badge);
    row.append(top,el('p',item.course+' · '+(item.dueDate?'Due '+item.dueDate:'No due date'),'meta'));
    if(item.tagColor){
      const tag=el('span',null,'color-tag');
      tag.setAttribute('role','img');
      tag.setAttribute('aria-label',nameFor(item.tagColor)+' tag');
      tag.title=nameFor(item.tagColor);
      tag.dataset.color=item.tagColor;
      row.append(tag);
    }
    if(item.notes)row.append(el('p',item.notes));
    const actions=el('div','','actions');
    const edit=el('button','Edit','secondary');
    const del=el('button','Delete','secondary delete');
    edit.disabled=del.disabled=busy;
    edit.setAttribute('aria-label','Edit '+item.title);
    del.setAttribute('aria-label','Delete '+item.title);
    edit.onclick=()=>{
      editing=item.id;
      for(const key of ['title','course','dueDate','status','notes','tagColor'])form.elements.namedItem(key).value=item[key]??'';
      heading.textContent='Edit project';cancel.hidden=false;
      form.elements.namedItem('title').focus();
    };
    del.onclick=async()=>{
      if(!confirm('Delete this project?'))return;
      await perform(async()=>{
        await api('/'+item.id,'DELETE');
        if(editing===item.id)reset();
        items=items.filter(row=>row.id!==item.id);
        notice.textContent='Project deleted.';
      });
    };
    const archive=el('button',item.archived?'Restore':'Archive','secondary');
    archive.disabled=busy;archive.onclick=()=>saveExtra(item,{archived:!item.archived});
    row.append(checklist(item));
    actions.append(edit,archive,del);row.append(actions);list.append(row);
  }
}
function reset(){editing='';form.reset();heading.textContent='Add project';cancel.hidden=true;}
async function perform(action){
  if(busy)return;
  busy=true;save.disabled=cancel.disabled=true;render();
  try{await action()}catch(error){notice.textContent=error.message}
  finally{busy=false;save.disabled=cancel.disabled=false;render()}
}
filter.onchange=tagFilter.onchange=render;
cancel.onclick=reset;
form.onsubmit=async event=>{
  event.preventDefault();
  const id=editing,body=Object.fromEntries(new FormData(form));
  await perform(async()=>{
    const item=await api(id?'/'+id:'',id?'PUT':'POST',body);
    items=[...items.filter(row=>row.id!==item.id),item].sort((a,b)=>(a.dueDate||'9999').localeCompare(b.dueDate||'9999')||b.updatedAt.localeCompare(a.updatedAt));
    filter.value=tagFilter.value='';if(!id&&archived)document.querySelector('#active-view').click();reset();notice.textContent=id?'Changes saved.':'Project added.';
  });
};
updateTagOptions();
notice.textContent='Loading projects…';
void perform(async()=>{items=await api();loaded=true;notice.textContent='';});
