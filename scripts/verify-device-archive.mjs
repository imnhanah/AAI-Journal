// Offline validation only. No cloud imports or source-store access.
import fs from'node:fs';import crypto from'node:crypto';import{parseArgs}from'node:util';
import{deviceRecoveryCopies,verifyDeviceRecovery}from'../src/deviceRecovery.js';
const{values,positionals}=parseArgs({allowPositionals:true,options:{owner:{type:'string'},report:{type:'string'},'allow-approved-real-backup':{type:'boolean',default:false}}});
if(positionals.length!==1||!values.owner||!values.report)throw new Error('Usage: node scripts/verify-device-archive.mjs FILE --owner UUID --report NEW_REPORT');
const real=new Set(['aae44aaf-41cf-442a-80f3-a2034da7e7f7','ad36667c-23bd-43c4-ba86-87afeb527283']);
if(real.has(values.owner)&&!values['allow-approved-real-backup'])throw new Error('Real-user validation requires separate approval; input was not read.');
const bytes=fs.readFileSync(positionals[0]),bundle=JSON.parse(bytes);await verifyDeviceRecovery(bundle,values.owner);
const report={fileSha256:crypto.createHash('sha256').update(bytes).digest('hex'),payloadSha256:bundle.payloadSha256,ownerId:values.owner,rawRecords:bundle.records.length,sourceCopies:deviceRecoveryCopies(bundle).length,settings:bundle.localStorage.length,issues:bundle.issues||[],independentBrowserDecodeAndRestoreRequired:true,certifiedReady:false};
fs.writeFileSync(values.report,JSON.stringify(report,null,2)+'\n',{mode:0o600,flag:'wx'});console.log(JSON.stringify({verified:true,rawRecords:report.rawRecords,sourceCopies:report.sourceCopies,issues:report.issues,certifiedReady:false}));
