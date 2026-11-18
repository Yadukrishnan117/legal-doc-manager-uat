import {readFileSync,mkdirSync,writeFileSync,existsSync} from 'node:fs';
import {resolve} from 'node:path';
import {randomBytes} from 'node:crypto';
import {database} from './database.ts';
import {objectStorage,clamAV,uatTextScanner} from './storage.ts';
import {createApplication} from './server.ts';
import {createStore,departments} from './core.ts';
import {recoverUatAdmin} from './uat-recovery.ts';
export function configuration(env:any=process.env){
 const uat=env.LDM_ENV==='uat',production=!uat&&env.NODE_ENV==='production',hosted=production||uat;
 const codespaces=uat&&env.CODESPACES==='true'&&/^[-a-z0-9]{1,100}$/.test(env.CODESPACE_NAME||'')&&env.GITHUB_CODESPACES_PORT_FORWARDING_DOMAIN==='app.github.dev'&&env.APP_ORIGIN==='https://'+env.CODESPACE_NAME+'-8788.app.github.dev';
 const root=resolve(env.LDM_RUNTIME||'production/.runtime'),port=Number(env.PORT||8788),org='chargemod';
 if(!hosted&&!['development','test'].includes(env.NODE_ENV||''))throw new Error('Set NODE_ENV=development or production explicitly.');
 if(production&&env.DEV_PASSWORD_LOGIN==='1')throw new Error('Development passwords are disabled in production.');
 if(uat&&(env.UAT_FICTIONAL_DATA_ONLY!=='1'||!env.LDM_RUNTIME))throw new Error('UAT requires a dedicated data directory and explicit fictional-data-only policy.');
 if(!hosted&&!existsSync(root+'/key')){mkdirSync(root,{recursive:true,mode:0o700});writeFileSync(root+'/key',randomBytes(32),{flag:'wx',mode:0o600})}
 const key=hosted?Buffer.from(env.LDM_DATA_KEY||'','base64'):readFileSync(root+'/key');if(key.length!==32)throw new Error('A private 32-byte LDM_DATA_KEY is required.');
 const origin=hosted?env.APP_ORIGIN:`http://127.0.0.1:${port}`;
 if(!origin||new URL(origin).origin!==origin||hosted&&!origin.startsWith('https://')||new URL(origin).username||new URL(origin).password)throw new Error('APP_ORIGIN must be an exact HTTPS origin.');
 if(!Number.isInteger(port)||port<1||port>65535)throw new Error('Invalid listening port.');
 if(production&&(!env.GOOGLE_CLIENT_ID||!env.GOOGLE_CLIENT_SECRET||!env.GOOGLE_WORKSPACE_DOMAIN||!env.S3_BUCKET||!env.S3_KMS_KEY_ARN||!env.CLAMAV_HOST))throw new Error('Production requires company SSO, private S3/KMS and malware scanning configuration.');
 if(production&&env.GOOGLE_REDIRECT_URI&&env.GOOGLE_REDIRECT_URI!==origin+'/auth/google/callback')throw new Error('Google callback must match APP_ORIGIN.');
 return {root,production,uat,codespaces,hosted,org,key,port,origin,passwordLogin:uat||!production&&env.DEV_PASSWORD_LOGIN==='1',db:{mode:production?'production':'development',path:root+(uat?'/postgres-uat-v1':'/postgres'),url:env.DATABASE_URL,ca:env.DATABASE_CA_FILE},storage:{production,key,directory:root+'/objects',bucket:env.S3_BUCKET,kmsKey:env.S3_KMS_KEY_ARN},scan:{production,host:env.CLAMAV_HOST,port:env.CLAMAV_PORT},google:{org,clientId:env.GOOGLE_CLIENT_ID,clientSecret:env.GOOGLE_CLIENT_SECRET,domain:env.GOOGLE_WORKSPACE_DOMAIN,redirectUri:origin+'/auth/google/callback'}};
}
export async function bootstrapUat(db:any,c:any,env:any=process.env){
 if(!c.uat)return;
 await db.transaction(c.org,async(conn:any)=>{const s=createStore(conn,{},{});const existing=await s.one('SELECT count(*) n FROM users');if(Number(existing.n))return;
 const password=env.LDM_BOOTSTRAP_PASSWORD;
 if(!password||password.length<20||password.length>200)throw new Error('An initial private UAT administrator password is required.');
 await s.addUser({id:'uat.admin',name:'UAT Administrator',org:c.org,role:'admin',departments},password);
 await s.sql('UPDATE users SET must_change_password=1,password_expires=? WHERE id=?',Date.now()+24*3600000,'uat.admin');
 await s.audit({id:'deployment-bootstrap',org:c.org},'users:uat-admin-created','uat.admin');
 });
}
export async function startRuntime(env:any=process.env){
 const c=configuration(env),db=await database(c.db),objects=objectStorage(c.storage),scanner=c.uat?uatTextScanner():clamAV(c.scan);
 try{await objects.assertReady();await scanner.assertReady();await bootstrapUat(db,c,env);await recoverUatAdmin(db,c,env)}catch(e){await db.close();throw e}
 const server=createApplication({...c,database:db,objects,scanner});
 server.requestTimeout=20000;server.headersTimeout=10000;server.keepAliveTimeout=5000;
 server.listen(c.port,c.hosted?'0.0.0.0':'127.0.0.1',()=>console.log(`Legal Doc Manager by 72BPM · ${c.uat?'UAT · FICTIONAL TXT DATA ONLY':c.production?'PRODUCTION':'DEVELOPMENT'} · ${c.origin}`));
 let stopping=false;const stop=()=>{if(stopping)return;stopping=true;server.close(async()=>{await db.close();process.exit(0)});setTimeout(()=>process.exit(1),20000).unref()};process.on('SIGTERM',stop);process.on('SIGINT',stop);
 return server;
}
if(process.argv[1]&&resolve(process.argv[1])===new URL(import.meta.url).pathname)await startRuntime();
