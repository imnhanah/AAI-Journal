import {useEffect,useRef,useState} from 'react';
import {ShieldCheck,AlertTriangle} from 'lucide-react';
import {officeApi} from './adminOfficeApi.js';
import './officeEnrollment.css';

const messages={not_allowed:'This account is not authorized to set up the Office.',reauthentication_required:'Sign out and sign in again, then reopen this setup. A recent sign-in is required.',session_unavailable:'Sign in again before continuing.',authenticator_code_used:'That code was already used. Wait for the next code.',wrong_code:'That code was not accepted. Enter a fresh code from your authenticator.',wrong_shared_pin:'That is not the shared Office PIN. Ask the other authorized Owner securely.',enrollment_rate_limited:'Too many attempts. Wait at least 10 minutes before trying again.',enrollment_expired:'This setup has expired. Close it and start again.',enrollment_in_progress:'A setup is already in progress. Cancel that setup before starting another.',authenticator_selection_required:'More than one authenticator is already linked. Contact support before continuing.'};
const safeQr=value=>typeof value==='string'&&value.length<=1398128&&/^data:image\/svg\+xml;base64,[A-Za-z0-9+/=]+$/.test(value);
export default function OfficeEnrollment({onReady,onClose}){
 const [phase,setPhase]=useState('checking'),[status,setStatus]=useState(null),[ticket,setTicket]=useState(null),[qr,setQr]=useState(''),[code,setCode]=useState(''),[pin,setPin]=useState(''),[repeat,setRepeat]=useState(''),[error,setError]=useState(''),[busy,setBusy]=useState(false);
 const alive=useRef(true),generation=useRef(0);
 const adopt=result=>{
  if(result.configured){onReady();return;}
  setStatus(result);
  if(result.recovery_required){setError('The linked authenticator is unavailable. Contact support to recover Office access.');setPhase('unavailable');return;}
  if(result.pending_ticket&&result.pending_factor_attached&&result.fresh_sign_in){
   setTicket({ticket_id:result.pending_ticket,pin_mode:result.pending_mode,mode:'resume',expires_at:result.pending_expires_at});
   setPhase(result.pending_verified?'pin':'verify');
  }else{setTicket(null);setPhase('start');}
 };
 const clear=()=>{setQr('');setCode('');setPin('');setRepeat('');};
 useEffect(()=>{
  alive.current=true;const epoch=++generation.current;let unsubscribe;
  officeApi.watchEnrollmentIdentity(()=>{generation.current++;clear();onClose();}).then(stop=>{if(alive.current)unsubscribe=stop;else stop?.();}).catch(()=>{if(alive.current&&generation.current===epoch){generation.current++;clear();setError('Your sign-in could not be verified. Reopen setup to try again.');setPhase('unavailable');}});
  officeApi.enrollmentStatus().then(result=>{if(!alive.current||generation.current!==epoch)return;adopt(result);}).catch(problem=>{if(alive.current&&generation.current===epoch){setError(messages[problem.code]||'Secure enrollment is unavailable. Please try again later.');setPhase('unavailable');}});
  const hidden=()=>{
   if(document.visibilityState==='hidden'){generation.current++;clear();setBusy(false);return;}
   const visibleEpoch=++generation.current;
   officeApi.enrollmentStatus().then(result=>{if(alive.current&&generation.current===visibleEpoch)adopt(result);}).catch(()=>{if(alive.current&&generation.current===visibleEpoch){setError('Secure enrollment could not be rechecked. Close and reopen it.');setPhase('unavailable');}});
  };document.addEventListener('visibilitychange',hidden);
  return()=>{alive.current=false;generation.current++;unsubscribe?.();document.removeEventListener('visibilitychange',hidden);};
 },[]);
 useEffect(()=>{
  if(!ticket?.expires_at)return undefined;
  const expires=Date.parse(ticket.expires_at);
  const expire=()=>{generation.current++;clear();setBusy(false);setError(messages.enrollment_expired);setPhase('unavailable');};
  if(!Number.isFinite(expires)){expire();return undefined;}
  const timer=setTimeout(expire,Math.max(0,expires-Date.now()));
  return ()=>clearTimeout(timer);
 },[ticket?.expires_at]);
 const run=async action=>{if(busy)return;setBusy(true);setError('');const epoch=generation.current;try{await action(()=>alive.current&&generation.current===epoch);}catch(problem){if(alive.current&&generation.current===epoch){if(problem.code==='wrong_shared_pin')setTicket(current=>current&&({...current,pin_mode:'join'}));setCode('');setPin('');setRepeat('');setError(messages[problem.code]||'The setup could not be confirmed.');}}finally{if(alive.current&&generation.current===epoch)setBusy(false);}};
 const begin=()=>run(async valid=>{
  const result=await officeApi.enrollmentBegin();if(!valid())return;
  if(result.mode==='scan'&&!safeQr(result.qr_code))throw Error('Invalid enrollment image');
  setTicket(result);setQr(result.mode==='scan'?result.qr_code:'');setPhase('verify');
 });
 const verify=event=>{event.preventDefault();run(async valid=>{const result=await officeApi.enrollmentVerify({ticket_id:ticket.ticket_id,totp_code:code});if(!valid())return;clear();setTicket(t=>({...t,pin_mode:result.pin_mode}));setPhase('pin');});};
 const finish=event=>{event.preventDefault();if(ticket.pin_mode==='create'&&pin!==repeat){setError('The PINs must match.');return;}run(async valid=>{await officeApi.enrollmentComplete({ticket_id:ticket.ticket_id,pin});if(!valid())return;clear();setTicket(null);onReady('Setup saved. Wait for the next authenticator code, then enter it and the shared PIN to unlock.');});};
 const cancel=()=>run(async valid=>{const pending=ticket?.ticket_id||status?.pending_ticket;if(pending)await officeApi.enrollmentCancel({ticket_id:pending});if(!valid())return;clear();setTicket(null);const next=await officeApi.enrollmentStatus();if(valid()){setStatus(next);setPhase('start');}});
 const number=set=>event=>set(event.target.value.replace(/\D/g,'').slice(0,6));
 return <div className="gate"><div className="gc office-enrollment"><div className="crest"><ShieldCheck size={26}/></div><div className="eyebrow">AAICOREFX · Administration Office</div>
  <h2>{phase==='pin'?(ticket.pin_mode==='create'?'Create the shared Office PIN':'Enter the shared Office PIN'):'Set up your authenticator'}</h2>
  {phase==='checking'&&<p role="status">Checking your account’s authorization…</p>}
  {phase==='start'&&<><p>Each authorized Owner uses their own authenticator. Both use the same Office PIN. </p>{status?.fresh_sign_in===false&&<p className="note">Sign out and sign in again before starting setup.</p>}<button className="btn pri" disabled={busy||!status?.fresh_sign_in||!!status?.pending_ticket} onClick={begin}>Set up authenticator</button></>}
  {phase==='verify'&&<form onSubmit={verify}>
   {qr?<><p>Scan this one-time QR code in your authenticator app. Do not share or photograph it.</p><img className="office-enrollment-qr" src={qr} alt="One-time authenticator enrollment QR code" referrerPolicy="no-referrer" draggable="false"/></>:<p>{ticket.mode==='existing'?'Use the authenticator already linked to this account.':'The QR is no longer displayed. If you scanned it, enter the generated code. Otherwise cancel and start again.'}</p>}
   <label>Authenticator code<input aria-label="Enrollment authenticator code" inputMode="numeric" autoComplete="one-time-code" maxLength={6} value={code} onChange={number(setCode)} required pattern="[0-9]{6}"/></label><button className="btn pri" disabled={busy||code.length!==6}>Verify authenticator</button>
  </form>}
  {phase==='pin'&&<form onSubmit={finish}><p>{ticket.pin_mode==='create'?'Create the six-digit PIN both authorized Owners will use. ':'Use the PIN already created by the other authorized Owner. This does not replace it.'}</p><label>{ticket.pin_mode==='create'?'New shared PIN':'Shared PIN'}<input aria-label="Shared Office PIN" type="password" inputMode="numeric" autoComplete="off" maxLength={6} value={pin} onChange={number(setPin)} required pattern="[0-9]{6}"/></label>{ticket.pin_mode==='create'&&<label>Confirm PIN<input aria-label="Confirm shared Office PIN" type="password" inputMode="numeric" autoComplete="off" maxLength={6} value={repeat} onChange={number(setRepeat)} required pattern="[0-9]{6}"/></label>}<button className="btn pri" disabled={busy||pin.length!==6||(ticket.pin_mode==='create'&&repeat.length!==6)}>Save secure setup</button></form>}
  {error&&<div className="note bad" role="alert"><AlertTriangle size={16}/><span>{error}</span></div>}
  <div className="mf"><button type="button" className="btn ghost" onClick={()=>{generation.current++;clear();onClose();}}>Close</button>{(ticket||status?.pending_ticket)&&<button type="button" className="btn ghost" disabled={busy} onClick={cancel}>Cancel this setup</button>}</div><p className="hint">Codes, PINs and QR images are kept only in this page’s memory and are cleared when you leave. Saving setup does not unlock the Office.</p>
 </div></div>;
}
