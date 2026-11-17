import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createRequire} from 'node:module';
import {databaseErrorMessage} from './databaseError.js';
const require=createRequire(import.meta.url);
const {transformSync}=require('esbuild');

test('journal protocol preserves existing headers and avoids unrelated endpoints',async()=>{
  const source=await readFile(new URL('./supabaseClient.js',import.meta.url),'utf8');
  const code=transformSync(source,{format:'cjs',define:{
    'import.meta.env':JSON.stringify({VITE_SUPABASE_URL:'https://staging.example.invalid',VITE_SUPABASE_ANON_KEY:'synthetic'}),
  }}).code;
  let options;
  const calls=[];
  const savedFetch=globalThis.fetch;
  const savedWindow=globalThis.window;
  globalThis.window={setTimeout,clearTimeout};
  globalThis.fetch=async(input,init)=>{calls.push({input,headers:new Headers(init.headers)});return new Response('{}',{status:200});};
  try{
    const module={exports:{}};
    const dependency=name=>name==='@supabase/supabase-js'
      ? {createClient:(_url,_key,value)=>{options=value;return {};}}
      : {notifyJournalMutation:()=>{}};
    new Function('require','module','exports',code)(dependency,module,module.exports);
    await options.global.fetch('https://staging.example.invalid/rest/v1/trades',{
      method:'POST',headers:{Authorization:'Bearer synthetic','X-Client-Info':'sdk/test'},body:'{}',
    });
    assert.equal(calls[0].headers.get('authorization'),'Bearer synthetic');
    assert.equal(calls[0].headers.get('x-client-info'),'sdk/test aai-journal/atomic-broker-v1');
    await options.global.fetch(new Request('https://staging.example.invalid/rest/v1/accounts',{
      method:'PATCH',headers:{'X-Client-Info':'sdk/test aai-journal/atomic-broker-v1'},body:'{}',
    }));
    assert.equal(calls[1].headers.get('x-client-info'),'sdk/test aai-journal/atomic-broker-v1');
    for(const url of ['https://staging.example.invalid/auth/v1/token',
      'https://staging.example.invalid/functions/v1/admin-office',
      'https://other.example.invalid/rest/v1/trades']){
      await options.global.fetch(url,{method:'POST'});
      assert.equal(calls.at(-1).headers.get('x-client-info'),null);
    }
    await options.global.fetch('https://staging.example.invalid/rest/v1/trades',{method:'GET'});
    assert.equal(calls.at(-1).headers.get('x-client-info'),null);
  }finally{
    globalThis.fetch=savedFetch;
    globalThis.window=savedWindow;
  }
});

test('refresh rejection is explicit and does not advise clearing browser data',()=>{
  const message=databaseErrorMessage({code:'PT409',message:'client_update_required'},'save your journal');
  assert.match(message,/refresh this tab/i);
  assert.match(message,/keep your unsaved work/i);
  assert.doesNotMatch(message,/clear|sign out|delete/i);
  assert.match(databaseErrorMessage({code:'42501',message:'denied'},'save'),/permission/i);
});
