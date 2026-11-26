const form=document.querySelector('#project-form');
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
function render(){
  const visible=items.filter(item=>(!filter.value||item.status===filter.value)&&(!tagFilter.value||(item.tagColor||'untagged')===tagFilter.value));
  for(const [key,value] of Object.entries({total:items.length,progress:items.filter(item=>item.status==='in-progress').length,complete:items.filter(item=>item.status==='completed').length})){
    document.querySelector('#'+key+'-count').textContent=loaded?value:'—';
  }
  list.replaceChildren();
  if(loaded&&!visible.length){list.append(el('li',(filter.value||tagFilter.value)?'No projects match this filter.':'No projects yet. Use the form to add your first project.'));return}
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
      tag.setAttribute('aria-label',item.tagColor+' tag');
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
    actions.append(edit,del);row.append(actions);list.append(row);
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
    filter.value=tagFilter.value='';reset();notice.textContent=id?'Changes saved.':'Project added.';
  });
};
notice.textContent='Loading projects…';
void perform(async()=>{items=await api();loaded=true;notice.textContent='';});
