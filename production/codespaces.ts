import {mkdirSync,existsSync,writeFileSync,readFileSync,openSync,closeSync} from 'node:fs';
import {resolve,dirname} from 'node:path';import {fileURLToPath} from 'node:url';
import {randomBytes} from 'node:crypto';import {spawn} from 'node:child_process';import http from 'node:http';
export function codespacesSettings(env:any,repositoryRoot:string){
 if(env.CODESPACES!=='true'||!/^[-a-z0-9]{1,100}$/.test(env.CODESPACE_NAME||'')||env.GITHUB_CODESPACES_PORT_FORWARDING_DOMAIN!=='app.github.dev')throw new Error('This launcher requires a github.com Codespace with its standard private forwarding domain.');
 const root=resolve(repositoryRoot,'.runtime/codespaces',env.CODESPACE_NAME),origin='https://'+env.CODESPACE_NAME+'-8788.app.github.dev';
 mkdirSync(root,{recursive:true,mode:0o700});
 const secretFile=root+'/private-settings.json';
 if(!existsSync(secretFile)){
  if(existsSync(root+'/postgres-uat-v1')||existsSync(root+'/objects'))throw new Error('Existing UAT data has no private settings. Restore the original key; do not create a replacement key.');
  const settings={key:randomBytes(32).toString('base64'),password:'Uat!'+randomBytes(18).toString('base64url')};
  writeFileSync(secretFile,JSON.stringify(settings),{flag:'wx',mode:0o600});
  writeFileSync(root+'/first-login.txt','Legal Doc Manager by 72BPM — private Codespaces UAT\nAccount: uat.admin\nTemporary password: '+settings.password+'\nChange this password on first login within 24 hours. After changing it, this initial password no longer works.\n',{flag:'wx',mode:0o600});
 }
 const settings=JSON.parse(readFileSync(secretFile,'utf8'));
 if(Buffer.from(settings.key||'','base64').length!==32||typeof settings.password!=='string'||settings.password.length<20)throw new Error('Private Codespaces UAT settings are invalid.');
 return {root,origin,credentials:root+'/first-login.txt',env:{...env,NODE_ENV:'production',LDM_ENV:'uat',UAT_FICTIONAL_DATA_ONLY:'1',LDM_RUNTIME:root,APP_ORIGIN:origin,PORT:'8788',LDM_DATA_KEY:settings.key,LDM_BOOTSTRAP_PASSWORD:settings.password,LDM_UAT_RECOVERY_PASSWORD:'',LDM_UAT_RECOVERY_ID:'',LDM_UAT_RECOVERY_EXPIRES:''}};
}
function healthy(origin:string){return new Promise<boolean>(done=>{const req=http.get('http://127.0.0.1:8788/health/ready',{headers:{Host:new URL(origin).host},timeout:1500},res=>{res.resume();done(res.statusCode===200)});req.on('error',()=>done(false));req.on('timeout',()=>req.destroy());});}
function info(c:any){console.log('Legal Doc Manager by 72BPM — private Codespaces UAT\nApp: '+c.origin+'\nFirst-login details: '+c.credentials+'\nKeep port 8788 PRIVATE. Use fictional TXT test data only. This Codespace stops when idle; deletion removes its UAT data.');}
async function main(){
 const repositoryRoot=resolve(dirname(fileURLToPath(import.meta.url)),'..'),c=codespacesSettings(process.env,repositoryRoot),action=process.argv[2]||'start';
 if(action==='info'){info(c);return}
 if(action==='serve'){const {startRuntime}=await import('./runtime.ts');await startRuntime(c.env);return}
 if(action!=='start')throw new Error('Use: node production/codespaces.ts start | info');
 if(await healthy(c.origin)){info(c);return}
 const pidFile=c.root+'/server.pid';let running=false;
 if(existsSync(pidFile)){const pid=Number(readFileSync(pidFile,'utf8'));if(Number.isSafeInteger(pid)&&pid>1){try{process.kill(pid,0);running=true}catch{}}}
 if(!running){const fd=openSync(c.root+'/server.log','a',0o600);
 try{const child=spawn(process.execPath,['--max-old-space-size=256','--wasm-num-compilation-tasks=1',fileURLToPath(import.meta.url),'serve'],{cwd:repositoryRoot,env:c.env,detached:true,stdio:['ignore',fd,fd]});if(child.pid)writeFileSync(pidFile,String(child.pid),{mode:0o600});child.unref();}finally{closeSync(fd)}}
 for(let i=0;i<40;i++){if(await healthy(c.origin)){info(c);return}await new Promise(r=>setTimeout(r,1000));}
 throw new Error('UAT did not become ready. Inspect the private server.log next to first-login.txt; no credentials are printed to logs.');
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url))await main();
