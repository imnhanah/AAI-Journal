import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import { prepareProfileLibraryDeviceCopy } from './profileCaseStudyRecovery.js';

const library = user => ({
  studies:[{id:`study-${user}`,evidenceIds:[`evidence-${user}`],evidencePlacements:{[`evidence-${user}`]:{caption:`${user} caption`,richDocument:{type:'doc',content:[{type:'text',text:user}]},annotations:[{id:`annotation-${user}`}],board:{objects:[{id:`text-${user}`,tool:'text',text:user,start:{x:20,y:30}}]}}}}],
  evidence:[{id:`evidence-${user}`,title:`${user} chart`}], personalTemplates:[{id:`template-${user}`,sections:['Overview']}], notebooks:[], settings:{validation:user}
});

test('Cloud Sync-off copy retains a complete profile library and board associations',()=>{
  const source=library('one');
  const result=prepareProfileLibraryDeviceCopy({cloudLibrary:source,localLibrary:null,visibleLibrary:source});
  assert.equal(result.data.studies[0].id,'study-one');
  assert.equal(result.data.evidence[0].id,'evidence-one');
  assert.equal(result.data.personalTemplates[0].id,'template-one');
  assert.equal(result.data.studies[0].evidencePlacements['evidence-one'].board.objects[0].text,'one');
  assert.equal(result.data.studies[0].evidencePlacements['evidence-one'].annotations[0].id,'annotation-one');
});

test('a failed cloud read and a divergent device copy preserve the last good local library',()=>{
  const local=library('local'), cloud=library('cloud');
  assert.match(prepareProfileLibraryDeviceCopy({cloudLibrary:null,localLibrary:local,visibleLibrary:local}).error,/could not be confirmed/i);
  assert.match(prepareProfileLibraryDeviceCopy({cloudLibrary:cloud,localLibrary:local,visibleLibrary:cloud}).error,/different saved Case Study Library/i);
  assert.deepEqual(local,library('local'));
});

test('retry succeeds after a failed read and users remain isolated',()=>{
  const one=library('one'), two=library('two');
  assert.ok(prepareProfileLibraryDeviceCopy({cloudLibrary:null,localLibrary:null,visibleLibrary:one}).error);
  const retry=prepareProfileLibraryDeviceCopy({cloudLibrary:one,localLibrary:null,visibleLibrary:one});
  assert.equal(retry.data.studies[0].id,'study-one');
  assert.notDeepEqual(retry.data,two);
});

test('Cloud Sync-off transition is serialized and enables local mode only after the guarded copy',()=>{
  const journal=readFileSync(new URL('./TradingJournal.jsx',import.meta.url),'utf8');
  assert.match(journal,/if \(cloudModeTransition\.current\) return;/);
  assert.match(journal,/cloudModeTransition\.current = true;/);
  assert.match(journal,/loadProfileCaseStudyLibrary\(user\.id\)/);
  assert.match(journal,/localJournal\.peekProfileCaseStudyLibrary\(user\.id\)/);
  assert.match(journal,/profileCaseStudyLibrary:profileCopy\.data/);
  assert.match(journal,/if \(profileCopy\.error\) return showError\(profileCopy\.error\);/);
  assert.match(journal,/if \(saved\.error\) return showError\(saved\.error\);[\s\S]*?localJournal\.configureLocalJournal\(user\.id, true\)/);
  assert.match(journal,/finally \{\n      cloudModeTransition\.current = false;/);
});
