import {test} from 'node:test';
import assert from 'node:assert/strict';
import {randomBytes,randomUUID} from 'node:crypto';
import {database} from '../database.ts';
import {createStore,departments} from '../core.ts';
import {recoverUatAdmin} from '../uat-recovery.ts';

test('trusted UAT recovery rotates once, revokes sessions, preserves access and never records secrets',async()=>{
 const db=await database({mode:'test'}),c={uat:true,production:false,org:'chargemod'},old=randomBytes(24).toString('base64url'),secret=randomBytes(24).toString('base64url');
 const env={LDM_UAT_RECOVERY_PASSWORD:secret,LDM_UAT_RECOVERY_ID:randomUUID(),LDM_UAT_RECOVERY_EXPIRES:String(Date.now()+600000)};
 const run=(fn:any)=>db.transaction(c.org,(conn:any)=>fn(createStore(conn,{},{})));
 try{
  await run(async(s:any)=>{await s.addUser({id:'uat.admin',name:'Test administrator',org:c.org,role:'admin',departments},old);await s.addUser({id:'sales',name:'Test sales',org:c.org,role:'sales',departments:[departments[0]]},old)});
  const prior=await run((s:any)=>s.login('uat.admin',old));
  await run((s:any)=>s.sql('UPDATE users SET must_change_password=1,password_expires=? WHERE id=?',Date.now()-1000,'uat.admin'));
  const unrelated=await run((s:any)=>s.one('SELECT * FROM users WHERE id=?','sales'));
  assert.equal(await recoverUatAdmin(db,{...c,uat:false,production:true},env),false);
  assert.equal(await recoverUatAdmin(db,c,{...env,LDM_UAT_RECOVERY_EXPIRES:String(Date.now()-1)}),false);
  assert.equal(await recoverUatAdmin(db,c,env),true);
  await run(async(s:any)=>{
   assert.equal(await s.session(prior.token),null);
   await assert.rejects(()=>s.login('uat.admin',old));
   const login=await s.login('uat.admin',secret);assert.equal(login.user.role,'admin');assert.deepEqual(login.user.departments,departments);assert.equal(login.user.mustChangePassword,true);assert.ok(login.user.passwordExpires>Date.now()+23*3600000);
   assert.deepEqual(await s.one('SELECT * FROM users WHERE id=?','sales'),unrelated);
  });
  const row=await run((s:any)=>s.one('SELECT * FROM users WHERE id=?','uat.admin'));
  assert.equal(await recoverUatAdmin(db,c,env),false);
  assert.deepEqual(await run((s:any)=>s.one('SELECT * FROM users WHERE id=?','uat.admin')),row);
  const logs=await run((s:any)=>s.all('SELECT * FROM audit'));assert.equal(logs.filter((x:any)=>x.action==='users:uat-admin-recovered').length,1);assert.equal(JSON.stringify(logs).includes(secret),false);
  await run((s:any)=>s.sql('UPDATE users SET role=? WHERE id=?','sales','uat.admin'));
  await assert.rejects(()=>recoverUatAdmin(db,c,{...env,LDM_UAT_RECOVERY_ID:randomUUID()}),/existing active UAT administrator/);
 }finally{await db.close()}
});
