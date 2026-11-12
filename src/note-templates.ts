function escapeHTML(s:string){return String(s||'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]!))}

type Local = readonly [string,string,string,string];
type Template = {id:string;name:Local;sections:Local[]};
export const noteTemplates: Template[] = [
  {id:'blank',name:['Blank note','空白笔记','白紙のノート','빈 노트'],sections:[]},
  {id:'lecture',name:['Lecture notes','课堂笔记','講義ノート','강의 노트'],sections:[
    ['Topic & date','主题与日期','テーマと日付','주제와 날짜'],
    ['Key concepts','核心概念','重要な概念','핵심 개념'],
    ['Examples','例子','例','예시'],
    ['Questions to review','待复习的问题','復習したい質問','복습할 질문'],
  ]},
  {id:'reading',name:['Reading notes','阅读笔记','読書ノート','독서 노트'],sections:[
    ['Source & pages','资料与页码','出典とページ','자료와 페이지'],
    ['Main argument','核心观点','主な論点','주요 주장'],
    ['Quotes & page numbers','摘录与页码','引用とページ番号','인용문과 페이지 번호'],
    ['My response','我的思考','自分の考察','나의 생각'],
  ]},
  {id:'assignment',name:['Assignment plan','作业计划','課題計画','과제 계획'],sections:[
    ['Brief & deadline','作业说明与截止时间','課題の概要と締切','과제 개요와 마감일'],
    ['Deliverables & criteria','提交内容与评分标准','提出物と評価基準','제출물과 평가 기준'],
    ['Tasks & milestones','任务与阶段目标','作業とマイルストーン','할 일과 단계별 목표'],
    ['Before submission','提交前检查','提出前の確認','제출 전 확인'],
  ]},
  {id:'meeting',name:['Group meeting','小组会议','グループ会議','그룹 회의'],sections:[
    ['Date & attendees','日期与参会成员','日付と参加者','날짜와 참석자'],
    ['Agenda','会议议程','議題','안건'],
    ['Decisions','小组决定','決定事項','결정 사항'],
    ['Next steps, owners & due dates','下一步、负责人和截止时间','次の作業・担当者・期限','다음 작업, 담당자 및 기한'],
  ]},
  {id:'research',name:['Research notes','研究笔记','リサーチノート','연구 노트'],sections:[
    ['Research question','研究问题','リサーチクエスチョン','연구 질문'],
    ['Key findings','主要发现','主な発見','주요 발견'],
    ['Sources','资料来源','参考資料','출처'],
  ]},
  {id:'process',name:['Process journal','过程日志','制作プロセス記録','작업 과정 기록'],sections:[
    ['What I did','我做了什么','取り組んだこと','한 일'],
    ['What I learned','我学到了什么','学んだこと','배운 점'],
    ['Next steps','下一步','次のステップ','다음 단계'],
  ]},
];
export function templateText(value:Local, language:unknown){
  return value[language==='zh'?1:language==='ja'?2:language==='ko'?3:0];
}
export function getTemplate(id:unknown){
  return noteTemplates.find(template=>template.id===id)??noteTemplates[0];
}
export function noteTemplateContent(id:unknown,language:unknown){
  const headings=getTemplate(id).sections.map(section=>templateText(section,language));
  return {body:headings.join('\n\n'),html:headings.map(heading=>'<h2>'+escapeHTML(heading)+'</h2><p><br></p>').join('')};
}
