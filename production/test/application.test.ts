import {test} from 'node:test';
import assert from 'node:assert/strict';
import {randomBytes} from 'node:crypto';
import {mkdtemp,rm,readFile,readdir} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {database} from '../database.ts';
import {createStore,departments,Fault} from '../core.ts';
import {objectStorage,clamAV} from '../storage.ts';
import {createApplication} from '../server.ts';
import {updateAccess} from '../access.ts';
import {configuration} from '../runtime.ts';
const password='Fictional-test-password-472!';
const body={clientId:'CL-000123',clientName:'Fictional Client',dept:'Station Management',type:'CPP Agreement',legal:'legal',sales:'sales',ops:'ops',team:'Sales',site:'Fictional site',details:'Agreement request for validation',due:'2026-11-15',scope:'Charging operations',share:'12',basis:'Net receipts; operator pays host',amount:'3',currency:'INR',unit:'charging session',setup:'0',maintenance:'0',frequency:'Monthly',purpose:'Contract administration',lawfulBasis:'Company Legal to review'};
const upload={filename:'draft.txt',content:Buffer.from('Fictional version one').toString('base64')};
async function fixture(){
 const root=await mkdtemp(tmpdir()+'/ldm-pg-'),key=randomBytes(32),db=await database({mode:'test'}),objects=objectStorage({directory:root+'/objects',key}),scanner=clamAV({});await objects.assertReady();
 await db.transaction('chargemod',async c=>{const s=createStore(c,objects,scanner);for(const [uid,role,ds] of [['manager','legal_manager',departments],['legal','legal_staff',departments],['sales','sales',departments],['ops','operations',departments],['admin','admin',departments],['auditor','auditor',['Station Management']],['otherSales','sales',departments],['stationLegal','legal_manager',['Station Management']],['reviewer','reviewer',['Software']]] as any)await s.addUser({id:uid,org:'chargemod',name:uid,role,departments:ds},password)});
 const run=(fn:any,org='chargemod')=>db.transaction(org,c=>fn(createStore(c,objects,scanner),c));
 const call=(name:string,actor:string,...args:any[])=>run(async s=>s[name](await s.user(actor),...args));
 const change=async(actor:string,rid:string,action:string,data:any={})=>{const r=await call('get',actor,rid);return call('transition',actor,rid,action,{...data,revision:r.revision})};
 const put=async(actor:string,rid:string,data:any=upload)=>{const r=await call('get',actor,rid);return call('upload',actor,rid,{...data,revision:r.revision})};
 return {root,key,db,objects,scanner,run,call,change,put,async close(){await db.close();await rm(root,{recursive:true,force:true})}};
}
const denied=(fn:any,status:number)=>assert.rejects(fn,(e:any)=>e instanceof Fault&&e.status===status);
test('PostgreSQL RLS and department/assignment permissions deny direct and API-service bypasses',async()=>{const f=await fixture();try{
 const r=await f.call('create','sales',body);
 for(const uid of ['admin','otherSales','reviewer']){assert.equal((await f.call('list',uid)).length,0);await denied(()=>f.call('get',uid,r.id),403)}
 await denied(()=>f.call('create','admin',body),403);
 const sw=await f.call('create','sales',{...body,dept:'Software',type:'White-label app agreement'});await f.put('legal',sw.id);
 await denied(()=>f.call('get','stationLegal',sw.id),403);await denied(()=>f.call('list','stationLegal','','Software'),403);await denied(()=>f.call('download','stationLegal',(f as any).missing||'missing'),404);
 await f.run(async(s,c)=>{assert.equal((await c.query('SELECT * FROM agreements')).rows.length,0)},'elsewhere');await assert.rejects(()=>f.run((s,c)=>c.query("INSERT INTO clients VALUES('foreign','chargemod','Denied')"),'elsewhere'));
 assert.equal((await f.call('list','manager')).length,2);
 }finally{await f.close()}});
test('client confirmation, manager approval, release, dispatch, scan and Legal verification are required in order',async()=>{const f=await fixture();try{
 const r=await f.call('create','sales',body);let a=await f.put('legal',r.id);const v1=a.documents[0].id;
 await denied(()=>f.call('download','sales',v1),403);await f.change('legal',r.id,'share');assert.equal((await f.call('download','sales',v1)).bytes.toString(),'Fictional version one');
 await f.change('sales',r.id,'send');await f.change('sales',r.id,'changes',{note:'Revise settlement'});await denied(()=>f.change('sales',r.id,'confirm',{evidence:'email',date:'2026-11-05'}),409);
 a=await f.put('legal',r.id,{...upload,content:Buffer.from('Revised v2').toString('base64')});const v2=a.documents[0].id;await denied(()=>f.call('download','sales',v2),403);
 await f.change('legal',r.id,'share');await denied(()=>f.call('download','sales',v1),403);await f.change('sales',r.id,'send');await f.change('sales',r.id,'confirm',{evidence:'Client email v2',date:'2026-11-05'});
 await denied(()=>f.change('legal',r.id,'release'),409);await denied(()=>f.change('legal',r.id,'approve',{evidence:'Not manager'}),403);await f.change('manager',r.id,'approve',{evidence:'Final AP-1'});await f.change('legal',r.id,'release');await denied(()=>f.put('legal',r.id),409);
 await denied(()=>f.change('ops',r.id,'dispatch',{}),409);await f.change('ops',r.id,'ack');await f.change('ops',r.id,'print');await f.change('ops',r.id,'dispatch',{method:'Courier',tracking:'DEMO1',destination:'Office',date:'2026-11-05'});await denied(()=>f.change('ops',r.id,'receive',{date:'2026-11-05',custody:'Cabinet'}),409);
 await f.put('ops',r.id,{...upload,kind:'original',filename:'signed.txt'});await f.change('ops',r.id,'receive',{date:'2026-11-05',custody:'Cabinet'});await denied(()=>f.change('ops',r.id,'verify',{}),403);await denied(()=>f.change('legal',r.id,'verify',{note:'Unchecked'}),409);
 const closed=await f.change('legal',r.id,'verify',{versionMatch:true,signatures:true,custodyVerified:true,note:'Verified exact v2'});assert.equal(closed.stage,'Fully Executed/Closed');assert.equal((await f.call('download','legal',v1)).bytes.toString(),'Fictional version one');
 await f.change('manager',r.id,'retention',{until:'2020-01-01',note:'Approved policy'});await f.change('manager',r.id,'hold',{hold:true,note:'Claim'});await denied(()=>f.call('deletion','manager',r.id,{reason:'Expired'}),409);
 }finally{await f.close()}});
test('common library publication pins client copies, preserves original lead date and deduplicates starts',async()=>{const f=await fixture();try{
 let t=await f.call('templateCreate','legal',{dept:body.dept,type:body.type,title:'CPP master'});t=await f.call('templateUpload','legal',t.id,{filename:'master.txt',content:Buffer.from('Client {{client_name}} at {{site}}: {{currency}} {{amount}} / {{unit}}').toString('base64')});assert.equal((await f.call('templateList','sales')).length,0);
 await denied(()=>f.call('templatePublish','legal',t.id,{evidence:'AP',version:1}),403);await f.call('templatePublish','manager',t.id,{evidence:'Master AP',version:1});
 const start={...body,templateVersion:1,leadClosed:true,leadRef:'LEAD1',leadCreatedAt:'2026-10-20T05:00:00Z',closureEvidence:'Closed lead record'};
 const r=await f.call('fromTemplate','sales',t.id,start);assert.equal(r.shared,1);assert.equal(r.created,'2026-10-20T05:00:00.000Z');assert.equal((await f.call('fromTemplate','sales',t.id,start)).id,r.id);await denied(()=>f.call('fromTemplate','sales',t.id,{...start,clientName:'Changed'}),409);
 const original=(await f.call('download','sales',r.documents[0].id)).bytes.toString();assert.ok(original.includes('Fictional Client'));
 await f.call('templateUpload','legal',t.id,{filename:'master.txt',content:Buffer.from('New master {{client_name}}').toString('base64')});await denied(()=>f.call('templatePublish','manager',t.id,{evidence:'Stale AP',version:1}),409);await f.call('templatePublish','manager',t.id,{evidence:'New AP',version:2});
 await denied(()=>f.call('templateDownload','sales',t.id,1),403);assert.equal((await f.call('download','sales',r.documents[0].id)).bytes.toString(),original);await denied(()=>f.call('templateList','admin'),403);
 }finally{await f.close()}});
test('stale writes return conflict and rejected transactions leave agreement and audit unchanged',async()=>{const f=await fixture();try{
 const r=await f.call('create','sales',body);await f.put('legal',r.id);await denied(()=>f.call('upload','legal',r.id,{...upload,revision:r.revision}),409);assert.equal((await f.call('get','legal',r.id)).documents.length,1);
 const before=await f.call('get','legal',r.id);await denied(()=>f.change('legal',r.id,'release'),409);assert.equal((await f.call('get','legal',r.id)).revision,before.revision);
 const attempts=await Promise.allSettled([f.call('transition','legal',r.id,'share',{revision:before.revision}),f.call('transition','legal',r.id,'share',{revision:before.revision})]);assert.equal(attempts.filter(x=>x.status==='fulfilled').length,1);assert.equal(attempts.filter(x=>x.status==='rejected').length,1);
 }finally{await f.close()}});
test('private objects are encrypted and security-check failures cannot create document records',async()=>{const f=await fixture();try{
 const r=await f.call('create','sales',body);await denied(()=>f.put('legal',r.id,{filename:'eicar.txt',content:Buffer.from('EICAR-STANDARD-ANTIVIRUS-TEST-FILE').toString('base64')}),422);assert.equal((await f.call('get','legal',r.id)).documents.length,0);
 await f.put('legal',r.id);const refs=await readdir(f.root+'/objects');const encrypted=await readFile(f.root+'/objects/'+refs[0]);assert.equal(encrypted.includes(Buffer.from('Fictional version one')),false);
 const unavailable={scan:async()=>{throw new Fault(503,'Scanner unavailable')}};await assert.rejects(()=>f.db.transaction('chargemod',async c=>{const s=createStore(c,f.objects,unavailable);await s.upload(await s.user('legal'),r.id,{...upload,revision:1})}));assert.equal((await f.call('get','legal',r.id)).v,1);
 }finally{await f.close()}});
test('HTTP login, cookie flags, CSRF, account revocation, scoped exports, rollback and production password denial',async()=>{const f=await fixture();let server:any;try{
 server=createApplication({database:f.db,objects:f.objects,scanner:f.scanner,key:f.key,org:'chargemod',origin:'http://127.0.0.1:18889',passwordLogin:true});await new Promise<void>(r=>server.listen(18889,'127.0.0.1',r));const origin='http://127.0.0.1:18889',request=(p:string,o:any={})=>fetch(origin+p,o);
 assert.equal((await request('/api/agreements')).status,401);const config=await (await request('/api/auth/config')).json();assert.equal(config.passwordLogin,true);
 assert.equal((await request('/api/login',{method:'POST',body:JSON.stringify({user:'sales',password})})).status,403);
 const login=await request('/api/login',{method:'POST',headers:{Origin:origin},body:JSON.stringify({user:'sales',password})});assert.equal(login.status,200);const cookie=login.headers.get('set-cookie')!;assert.ok(cookie.includes('HttpOnly'));assert.ok(cookie.includes('SameSite=Strict'));const session=await login.json(),headers={Origin:origin,Cookie:cookie.split(';')[0],'X-CSRF-Token':session.csrf};
 assert.equal((await request('/api/agreements',{method:'POST',headers:{Cookie:headers.Cookie},body:'{}'})).status,403);
 let response=await request('/api/agreements',{method:'POST',headers,body:JSON.stringify({...body,requester:'admin',role:'legal_manager',stage:'Fully Executed/Closed'})});assert.equal(response.status,201);const r=await response.json();assert.equal(r.requester,'sales');assert.equal(r.stage,'Draft');assert.equal((await request('/api/export',{headers})).status,403);
 await f.call('admin','admin','sales',{active:false});assert.equal((await request('/api/me',{headers})).status,401);assert.equal((await f.run(s=>s.all("SELECT * FROM audit WHERE decision LIKE 'deny:%'"))).length>0,true);
 await new Promise<void>(r=>server.close(r));const productionOrigin='http://127.0.0.1:18891';server=createApplication({database:f.db,objects:f.objects,scanner:f.scanner,key:f.key,org:'chargemod',origin:productionOrigin,production:true,passwordLogin:true});await new Promise<void>(r=>server.listen(18891,'127.0.0.1',r));assert.equal((await fetch(productionOrigin+'/api/login',{method:'POST',headers:{Origin:productionOrigin},body:JSON.stringify({user:'legal',password})})).status,403);
 }finally{if(server?.listening)await new Promise<void>(r=>server.close(r));await f.close()}});
test('failed sign-ins consume durable rate limits, including across rejected transactions',async()=>{const f=await fixture();let server:any;try{
 const origin='http://127.0.0.1:18890';server=createApplication({database:f.db,objects:f.objects,scanner:f.scanner,key:f.key,org:'chargemod',origin,passwordLogin:true});await new Promise<void>(r=>server.listen(18890,'127.0.0.1',r));
 for(let i=0;i<10;i++)assert.equal((await fetch(origin+'/api/login',{method:'POST',headers:{Origin:origin},body:JSON.stringify({user:'sales',password:'wrong-password'})})).status,401);
 assert.equal((await fetch(origin+'/api/login',{method:'POST',headers:{Origin:origin},body:JSON.stringify({user:'sales',password})})).status,429);
 }finally{if(server?.listening)await new Promise<void>(r=>server.close(r));await f.close()}});
test('production startup fails closed for missing secrets, insecure origin or development password mode',()=>{
 assert.throws(()=>configuration({NODE_ENV:'production'}));assert.throws(()=>configuration({NODE_ENV:'production',DEV_PASSWORD_LOGIN:'1'}));assert.throws(()=>configuration({NODE_ENV:'production',LDM_DATA_KEY:randomBytes(32).toString('base64'),APP_ORIGIN:'http://example.invalid'}));
});

test('trusted access changes validate grants and immediately revoke sessions',async()=>{const f=await fixture();try{
 const session=await f.run(s=>s.login('sales',password));assert.ok(await f.run(s=>s.session(session.token)));
 await f.run(s=>updateAccess(s,'chargemod',{id:'sales',role:'reviewer',team:'Accounts',departments:['Software'],active:true,reason:'Approved access ticket TEST-1'}));
 assert.equal(await f.run(s=>s.session(session.token)),null);const u=await f.run(s=>s.user('sales'));assert.equal(u.role,'reviewer');assert.equal(u.team,'Accounts');assert.deepEqual(u.departments,['Software']);
 await denied(()=>f.run(s=>updateAccess(s,'chargemod',{id:'sales',role:'admin',departments:['Unknown'],active:true,reason:'Denied'})),400);
 assert.equal((await f.run(s=>s.user('sales'))).role,'reviewer');
 }finally{await f.close()}});

test('administrator HTTP lifecycle creates, edits, resets, removes and restores accounts without document privileges',async()=>{const f=await fixture();let server:any;try{
 const origin='http://127.0.0.1:18894';server=createApplication({database:f.db,objects:f.objects,scanner:f.scanner,key:f.key,org:'chargemod',origin,passwordLogin:true});await new Promise<void>(r=>server.listen(18894,'127.0.0.1',r));
 const login=async(id:string,pw:string)=>{const response=await fetch(origin+'/api/login',{method:'POST',headers:{Origin:origin},body:JSON.stringify({user:id,password:pw})});const result=await response.json();return {status:response.status,result,headers:{Origin:origin,Cookie:response.headers.get('set-cookie')?.split(';')[0]||'','X-CSRF-Token':result.csrf||''}}};
 const request=(path:string,session:any,method='GET',body?:any)=>fetch(origin+path,{method,headers:session.headers,...(body?{body:JSON.stringify(body)}:{})});
 const admin=await login('admin',password),sales=await login('sales',password);
 const record=await f.call('create','sales',body);assert.equal((await request('/api/agreements/'+record.id,admin)).status,403);
 assert.equal((await request('/api/users/audit',sales)).status,403);assert.equal((await request('/api/users/audit',admin)).status,200);
 const newUser={id:'new.employee',name:'New employee',role:'sales',departments:['Software'],reason:'Approved onboarding request'};
 assert.equal((await request('/api/users',sales,'POST',newUser)).status,403);
 assert.equal((await fetch(origin+'/api/users',{method:'POST',headers:{Cookie:admin.headers.Cookie},body:JSON.stringify(newUser)})).status,403);
 const created=await request('/api/users',admin,'POST',newUser);assert.equal(created.status,201);const credential=await created.json();assert.equal(credential.temporaryPassword.length>=14,true);assert.equal(credential.mustChangePassword,true);
 assert.equal((await request('/api/users',admin,'POST',newUser)).status,409);
 let directory=await (await request('/api/users',admin)).json(),row=directory.find((u:any)=>u.id===newUser.id);assert.equal(row.hash,undefined);assert.equal(row.salt,undefined);assert.equal(JSON.stringify(directory).includes(credential.temporaryPassword),false);
 const employee=await login(newUser.id,credential.temporaryPassword);assert.equal(employee.status,200);assert.equal(employee.result.user.mustChangePassword,true);assert.equal((await request('/api/agreements',employee)).status,403);
 assert.equal((await request('/api/password',employee,'POST',{currentPassword:credential.temporaryPassword,newPassword:'short'})).status,400);
 assert.equal((await request('/api/password',employee,'POST',{currentPassword:credential.temporaryPassword,newPassword:'New-employee-unique-pass-549!'})).status,200);
 assert.equal((await request('/api/me',employee)).status,401);
 let updated=await login(newUser.id,'New-employee-unique-pass-549!');assert.equal(updated.result.user.mustChangePassword,false);assert.equal((await request('/api/users',updated)).status,403);
 directory=await (await request('/api/users',admin)).json();row=directory.find((u:any)=>u.id===newUser.id);
 assert.equal((await request('/api/users/'+newUser.id,admin,'PATCH',{name:'New Accounts reviewer',role:'reviewer',team:'Accounts',departments:['Station Management'],active:true,revision:row.account_revision,reason:'Approved transfer'})).status,200);
 assert.equal((await request('/api/me',updated)).status,401);
 assert.equal((await request('/api/users/'+newUser.id,admin,'PATCH',{active:false,revision:row.account_revision,reason:'Stale update'})).status,409);
 directory=await (await request('/api/users',admin)).json();row=directory.find((u:any)=>u.id===newUser.id);
 let response=await request('/api/users/'+newUser.id+'/credentials',admin,'POST',{action:'reset-password',revision:row.account_revision,reason:'Employee recovery'});assert.equal(response.status,200);const reset=await response.json();assert.notEqual(reset.temporaryPassword,credential.temporaryPassword);
 assert.equal((await login(newUser.id,'New-employee-unique-pass-549!')).status,401);
 directory=await (await request('/api/users',admin)).json();row=directory.find((u:any)=>u.id===newUser.id);
 response=await request('/api/users/'+newUser.id,admin,'DELETE',{revision:row.account_revision,reason:'Offboarding'});assert.equal(response.status,200);assert.equal((await login(newUser.id,reset.temporaryPassword)).status,401);
 directory=await (await request('/api/users',admin)).json();row=directory.find((u:any)=>u.id===newUser.id);assert.ok(row.deleted_at);assert.equal(row.active,0);assert.equal((await f.call('get','legal',record.id)).id,record.id);
 assert.equal((await request('/api/users/'+newUser.id+'/credentials',admin,'POST',{action:'restore',revision:row.account_revision,reason:'Rehire review'})).status,200);
 const restored=await f.run(s=>s.user(newUser.id));assert.equal(restored.active,0);assert.equal(restored.password_enabled,0);
 const self=directory.find((u:any)=>u.id==='admin');assert.equal((await request('/api/users/admin',admin,'DELETE',{revision:self.account_revision,reason:'Self remove'})).status,409);
 const logs=await f.run(s=>s.all('SELECT action,target FROM audit'));assert.equal(JSON.stringify(logs).includes(credential.temporaryPassword),false);assert.equal(JSON.stringify(logs).includes(reset.temporaryPassword),false);
 }finally{if(server?.listening)await new Promise<void>(r=>server.close(r));await f.close()}});

test('administrator management validates Google identities, organization boundaries and expired credentials',async()=>{const {createUser,userCredentials,editUser,removeUser}=await import('../users.ts');const f=await fixture();try{
 const run=(fn:any,uid='admin')=>f.run(async s=>fn(s,await s.user(uid)));
 await denied(()=>run((s:any,u:any)=>createUser(s,u,{id:'invalid',name:'Invalid',role:'sales',departments:['Unknown'],reason:'Test'},true)),400);
 await denied(()=>run((s:any,u:any)=>createUser(s,u,{id:'sso',name:'SSO',role:'sales',departments:['Software'],reason:'Test'},false)),400);
 await run((s:any,u:any)=>createUser(s,u,{id:'sso',name:'SSO',role:'sales',departments:['Software'],reason:'Verified onboarding',googleSubject:'subject-1',identityVerified:true},false));
 const sso=await f.run(s=>s.user('sso'));assert.equal(sso.password_enabled,0);
 await denied(()=>run((s:any,u:any)=>createUser(s,u,{id:'duplicate.sso',name:'Duplicate',role:'sales',departments:['Software'],reason:'Test',googleSubject:'subject-1',identityVerified:true},false)),409);
 await denied(()=>run((s:any,u:any)=>userCredentials(s,u,'sso',{action:'reset-password',revision:0,reason:'Test'},false)),403);
 await denied(()=>run((s:any,u:any)=>userCredentials(s,u,'sso',{action:'link-google',revision:0,reason:'Test',googleSubject:'unverified'},false)),400);
 await run((s:any,u:any)=>userCredentials(s,u,'sso',{action:'unlink-google',revision:0,reason:'Access recovery'},false));assert.equal((await f.run(s=>s.all('SELECT * FROM identities WHERE user_id=?','sso'))).length,0);
 const temp=await run((s:any,u:any)=>createUser(s,u,{id:'expired',name:'Expired',role:'sales',departments:['Software'],reason:'Test expiry'},true));await f.run(s=>s.sql('UPDATE users SET password_expires=? WHERE id=?',Date.now()-1000,'expired'));await denied(()=>f.run(s=>s.login('expired',temp.temporaryPassword)),401);
 await denied(()=>run((s:any,u:any)=>editUser(s,u,'admin',{active:false,reason:'Self change',revision:0})),409);
 await assert.rejects(()=>run((s:any,u:any)=>removeUser(s,{...u,org:'elsewhere'},'sales',{reason:'Foreign removal',revision:0})),(e:any)=>e.code==='42501');
 }finally{await f.close()}});
