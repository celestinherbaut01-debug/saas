import {spawn} from 'node:child_process';
const children=[];
function start(args,ready){return new Promise((resolve,reject)=>{const child=spawn(process.execPath,args,{cwd:process.cwd(),env:{...process.env,NEXT_PUBLIC_SUPABASE_URL:'http://127.0.0.1:54329',NEXT_PUBLIC_SUPABASE_ANON_KEY:'fixture-public-key'},stdio:['ignore','pipe','pipe']});children.push(child);let output='';const timer=setTimeout(()=>reject(new Error('Startup timeout: '+output)),30000);child.stdout.on('data',chunk=>{output+=chunk;if(output.includes(ready)){clearTimeout(timer);resolve(child);}});child.stderr.on('data',chunk=>output+=chunk);child.on('exit',code=>{clearTimeout(timer);if(code)reject(new Error('Startup failed: '+output));});});}
try{
 await start(['tests/v4-fixture-server.mjs'],'Isolated Supabase fixture');
 await start(['node_modules/next/dist/bin/next','start','--hostname','127.0.0.1','--port','3010'],'Ready');
 const test=spawn(process.execPath,['--import','tsx','tests/v4-http.mjs'],{stdio:'inherit'});const code=await new Promise(resolve=>test.on('exit',resolve));if(code)process.exitCode=code;
}finally{for(const child of children)child.kill('SIGTERM');}
