import {encodeDraftValue,decodeDraftValue} from './journalPayloadCodecs.js';

export function createJournalDraftController({repository,feature,recordId,initialValue,onError=()=>{},mergeRecovered=(old,next)=>({...old,...next})}){
  let value=structuredClone(initialValue),revision=0,sequence=0,dirty=false,error=null,blocked=false;
  let snapshot,loaded=false,recoveredValue,tail=Promise.resolve();const listeners=new Set();
  const publish=()=>{snapshot={value,revision,sequence,dirty,error};for(const listener of listeners)listener();};publish();
  const ready=repository.readDraft(feature,recordId).then(row=>{
    revision=row?.revision||0;
    if(row?.payload?.codecVersion===1&&row.payload.state==='dirty'){
      const recovered=decodeDraftValue(row.payload.value);recoveredValue=recovered;value=sequence?mergeRecovered(recovered,value):recovered;dirty=true;
    }else if(row&&row.payload?.codecVersion!==1)throw new Error('Unknown safety-draft format. Original draft is retained.');
    loaded=true;publish();
  }).catch(failure=>{blocked=true;error=failure;publish();onError(failure);throw failure;});
  void ready.catch(()=>{});
  const persist=(captured,state='dirty',onlyIfCurrent=false)=>{
    const work=tail.catch(()=>{}).then(async()=>{
      await ready;if(blocked)throw error;
      if(captured.beforeReady&&recoveredValue!==undefined){captured={...captured,value:mergeRecovered(recoveredValue,captured.value)};if(sequence===captured.sequence)value=structuredClone(captured.value);}
      if(onlyIfCurrent&&(sequence!==captured.sequence||JSON.stringify(encodeDraftValue(value))!==JSON.stringify(encodeDraftValue(captured.value))))return false;
      const result=await repository.saveDraft({feature,recordId,expectedRevision:revision,baseRevision:null,
        payload:{codecVersion:1,state,value:encodeDraftValue(captured.value)}});
      revision=result.draft.revision;
      if(sequence===captured.sequence){dirty=state==='dirty';error=null;publish();}
      return true;
    });
    tail=work.catch(failure=>{error=failure;blocked=['DRAFT_CONFLICT','SESSION_CHANGED','SIGNED_OUT','UNKNOWN_RECORD_SCHEMA','INVALID_DRAFT_SCHEMA'].includes(failure.code);publish();onError(failure);throw failure;});void tail.catch(()=>{});return tail;
  };
  return {
    subscribe(listener){listeners.add(listener);return()=>listeners.delete(listener);},getSnapshot:()=>snapshot,
    async ready(){await ready;return snapshot;},
    edit(update){
      value=typeof update==='function'?update(structuredClone(value)):structuredClone(update);sequence++;dirty=true;publish();
      void persist({value:structuredClone(value),sequence,beforeReady:!loaded});return value;
    },
    async capture(){
      const retry=error&&!blocked&&dirty;
      await ready;if(retry)await persist({value:structuredClone(value),sequence});
      const captured={value:structuredClone(value),sequence,scopeKey:feature+':'+recordId,operationId:globalThis.crypto.randomUUID()};
      const pending=tail;await pending;captured.revision=revision;return captured;
    },
    async flush(){const retry=error&&!blocked&&dirty;await ready;if(retry)await persist({value:structuredClone(value),sequence});await tail;return snapshot;},
    async acknowledge(captured){return persist(captured,'confirmed',true);},
    async dismiss(){await ready;await tail;return persist({value:structuredClone(value),sequence},'dismissed',true);},
    setConfirmed(next){if(!dirty){value=structuredClone(next);publish();}},
  };
}
