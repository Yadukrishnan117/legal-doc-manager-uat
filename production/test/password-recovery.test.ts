import {test} from 'node:test';import assert from 'node:assert/strict';import http from 'node:http';
import {randomBytes} from 'node:crypto';
import {database} from '../database.ts';import {createStore,departments} from '../core.ts';
import {generateRecoveryCodes,recoveryCodeStatus,resetWithRecoveryCode} from '../password-recovery.ts';import {createApplication} from '../server.ts';
const options={uat:true,production:false,passwordLogin:true,org:'chargemod'};
const old='Initial-password!12345',next='Changed-password!12345';
async function fixture(){const db=await database({mode:'test'});const run=(fn:any)=>db.transaction(options.org,(c:any)=>fn(createStore(c,{},{})));await run(async(s:any)=>{await s.addUser({id:'uat.admin',org:options.org,name:'Administrator',role:'admin',departments},old);await s.addUser({id:'sales',org:options.org,name:'Sales',role:'sales',departments:[departments[0]]},old)});return{db,run}}
test('recovery codes are private, single-use and recover expired administrator credentials without changing grants',async()=>{
 const f=await fixture();try{
  const admin=await f.run((s:any)=>s.user('uat.admin')),sales=await f.run((s:any)=>s.user('sales'));
  await assert.rejects(()=>f.run((s:any)=>generateRecoveryCodes(s,admin,{currentPassword:'incorrect'},options)));
  await assert.rejects(()=>f.run((s:any)=>generateRecoveryCodes(s,sales,{currentPassword:old},options)));
  await assert.rejects(()=>f.run((s:any)=>generateRecoveryCodes(s,admin,{currentPassword:old},{...options,production:true})));
  const result=await f.run((s:any)=>generateRecoveryCodes(s,admin,{currentPassword:old},options));assert.equal(new Set(result.codes).size,10);
  const before=await f.run((s:any)=>s.one('SELECT recovery_codes FROM users WHERE id=?',admin.id));assert.equal(before.recovery_codes.includes(result.codes[0]),false);
  const session=await f.run((s:any)=>s.login(admin.id,old));
  await f.run((s:any)=>s.sql('UPDATE users SET password_expires=?,must_change_password=1 WHERE id=?',Date.now()-1000,admin.id));
  const invalid={user:admin.id,code:'bad-code',newPassword:next};
  await assert.rejects(()=>f.run((s:any)=>resetWithRecoveryCode(s,invalid,options)),/account or recovery code/);
  await assert.rejects(()=>f.run((s:any)=>resetWithRecoveryCode(s,{...invalid,user:'unknown'},options)),/account or recovery code/);
  await f.run((s:any)=>resetWithRecoveryCode(s,{user:admin.id,code:result.codes[0].toLowerCase(),newPassword:next},options));
  const user=await f.run((s:any)=>s.user(admin.id));assert.deepEqual(user.departments,admin.departments);assert.equal(user.role,'admin');assert.equal(user.mustChangePassword,false);assert.equal(user.passwordExpires,null);
  assert.equal(await f.run((s:any)=>s.session(session.token)),null);
  await assert.rejects(()=>f.run((s:any)=>s.login(admin.id,old)));assert.equal((await f.run((s:any)=>s.login(admin.id,next))).user.id,admin.id);
  await assert.rejects(()=>f.run((s:any)=>resetWithRecoveryCode(s,{user:admin.id,code:result.codes[0],newPassword:old},options)));
  assert.equal((await f.run((s:any)=>recoveryCodeStatus(s,user,options))).remaining,9);
  const rotated=await f.run((s:any)=>generateRecoveryCodes(s,user,{currentPassword:next},options));assert.equal(rotated.codes.length,10);
  await assert.rejects(()=>f.run((s:any)=>resetWithRecoveryCode(s,{user:admin.id,code:result.codes[1],newPassword:old},options)));
  await f.run((s:any)=>s.sql('UPDATE users SET active=0 WHERE id=?',admin.id));
  await assert.rejects(()=>f.run((s:any)=>resetWithRecoveryCode(s,{user:admin.id,code:rotated.codes[0],newPassword:old},options)));
  const audit=JSON.stringify(await f.run((s:any)=>s.all('SELECT * FROM audit')));for(const secret of [...result.codes,...rotated.codes,old,next])assert.equal(audit.includes(secret),false);
 }finally{await f.db.close()}
});
test('HTTP recovery requires trusted origin, authenticated setup and CSRF, denies production, and throttles guessing',async()=>{
 const f=await fixture(),origin='http://127.0.0.1:18896';const server=createApplication({...options,origin,key:randomBytes(32),database:f.db,objects:{},scanner:{}});await new Promise<void>(r=>server.listen(18896,'127.0.0.1',r));
 const request=(path:string,method='GET',body?:any,headers:any={})=>fetch(origin+path,{method,headers:{'Content-Type':'application/json',...headers},...(body?{body:JSON.stringify(body)}:{})});
 try{
  assert.equal((await request('/api/recovery-codes')).status,401);
  assert.equal((await request('/api/password-recovery','POST',{user:'uat.admin',code:'bad',newPassword:next})).status,403);
  const login=await request('/api/login','POST',{user:'uat.admin',password:old},{Origin:origin}),session=await login.json(),cookie=login.headers.get('set-cookie')!.split(';')[0];
  assert.equal((await request('/api/recovery-codes','POST',{currentPassword:old},{Origin:origin,Cookie:cookie})).status,403);
  const generated=await request('/api/recovery-codes','POST',{currentPassword:old},{Origin:origin,Cookie:cookie,'x-csrf-token':session.csrf});assert.equal(generated.status,200);const {codes}=await generated.json();
  assert.equal((await request('/api/password-recovery','POST',{user:'uat.admin',code:codes[0],newPassword:next},{Origin:origin})).status,200);
  assert.equal((await request('/api/me','GET',undefined,{Cookie:cookie})).status,401);
  let response:any;for(let i=0;i<11;i++)response=await request('/api/password-recovery','POST',{user:'unknown',code:'bad',newPassword:next},{Origin:origin});assert.equal(response.status,429);
 }finally{await new Promise<void>(r=>server.close(r));await f.db.close()}
});
