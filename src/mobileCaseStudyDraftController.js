import {normaliseCaseStudyWorkspace} from './caseStudyWorkspace.js';
import {patchSectionRichDocument,richDocumentText,migrateSectionRichDocument} from './studyRichDocument.js';
import {normalizeSaveOutcome,saveSucceeded} from './syncOutcome.js';

function apply(base,intents){
  let workspace=normaliseCaseStudyWorkspace(base);
  for(const intent of intents){workspace={...workspace,studies:workspace.studies.map(study=>{
    if(study.id!==intent.studyId)return study;
    const patch=intent.kind==='section'?patchSectionRichDocument(study,intent.name,intent.index,intent.document):intent.patch;
    return {...study,...patch,updatedAt:intent.at};
  })};}
  return workspace;
}
export function createMobileStudyDraftController({context,workspace,revision,textToDoc,submit,delay=1200,timers=globalThis}){
  const initial={baseWorkspace:normaliseCaseStudyWorkspace(workspace),baseRevision:revision??null,intents:[],workspace:normaliseCaseStudyWorkspace(workspace)};
  const draft=context.draft('mobile-case-study','profile-library',initial,()=>{},(old,next)=>{
    const intents=[...old.intents,...next.intents];return {...old,intents,workspace:apply(old.baseWorkspace,intents)};
  });
  let timer=null,flight=false,error=null,transport=submit,snapshot,attached=true,unsubscribe;const listeners=new Set();
  const publish=()=>{snapshot={workspace:draft.getSnapshot().value.workspace,error:error||draft.getSnapshot().error};for(const listener of listeners)listener();};publish();unsubscribe=draft.subscribe(publish);
  const schedule=()=>{if(!attached)return;timers.clearTimeout(timer);timer=timers.setTimeout(()=>{void flushCloud();},delay);};
  const edit=intent=>{
    const next={...intent,id:globalThis.crypto.randomUUID(),at:new Date().toISOString()};
    draft.edit(current=>{const intents=[...current.intents.filter(i=>i.identity!==next.identity),next];return {...current,intents,workspace:apply(current.baseWorkspace,intents)};});
    schedule();
  };
  async function flushCloud(){
    timers.clearTimeout(timer);timer=null;if(flight)return false;
    flight=true;error=null;
    try{
      const attempt=await draft.capture(),value=attempt.value;
      if(!value.intents.length)return true;
      const response=await transport({workspace:value.workspace,baseWorkspace:value.baseWorkspace,baseRevision:value.baseRevision,operationId:attempt.operationId,draftRevision:attempt.revision});
      const outcome=normalizeSaveOutcome(response?.outcome??response);
      if(!saveSucceeded(outcome))throw new Error(outcome.error||'Case Study edits are saved on this device and need retry.');
      const submitted=new Set(value.intents.map(i=>i.id));
      draft.edit(current=>{
        const intents=current.intents.filter(i=>!submitted.has(i.id));
        return {baseWorkspace:response.workspace,baseRevision:response.revision??null,intents,workspace:apply(response.workspace,intents)};
      });
      const next=await draft.capture();
      if(!next.value.intents.length)await draft.acknowledge(next);else schedule();
      return true;
    }catch(failure){error=failure;return false;}
    finally{flight=false;publish();}
  }
  return {
    subscribe(listener){listeners.add(listener);return()=>listeners.delete(listener);},getSnapshot:()=>snapshot,
    updateTransport(next){transport=next;},
    receiveConfirmed(next,nextRevision){
      if(!draft.getSnapshot().dirty){draft.setConfirmed({baseWorkspace:normaliseCaseStudyWorkspace(next),baseRevision:nextRevision??null,intents:[],workspace:normaliseCaseStudyWorkspace(next)});}
      else if(!flight&&nextRevision!==draft.getSnapshot().value.baseRevision){error=new Error('Cloud changes are available; local edits are retained for reconciliation.');publish();}
    },
    patchStudy(studyId,patch){edit({kind:'patch',studyId,patch,identity:JSON.stringify([studyId,'patch',Object.keys(patch).sort()])});},
    editSection(studyId,{name,index,text}){edit({kind:'section',studyId,name,index,document:textToDoc(text),identity:JSON.stringify([studyId,'section',index,name])});},
    sectionText(studyId,{name,index}){const study=draft.getSnapshot().value.workspace.studies.find(s=>s.id===studyId);return study?richDocumentText(migrateSectionRichDocument(study,name,index)):'';},
    flushLocal:()=>draft.flush(),flushCloud,
    attachView(){attached=true;if(!unsubscribe)unsubscribe=draft.subscribe(publish);publish();},
    detachView(){attached=false;timers.clearTimeout(timer);timer=null;unsubscribe?.();unsubscribe=null;},
  };
}
