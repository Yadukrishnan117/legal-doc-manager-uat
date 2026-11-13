import {randomBytes,scryptSync} from 'node:crypto';
import {createStore} from './core.ts';
import {accountLock} from './users.ts';

// Trusted Railway operators only: no public recovery endpoint and no production
// password override. Each short-lived request is consumed once in the audit log.
export async function recoverUatAdmin(db:any,c:any,env:any=process.env){
 if(!c.uat||c.production)return false;
 const secret=env.LDM_UAT_RECOVERY_PASSWORD;
 if(!secret)return false;
 const request=env.LDM_UAT_RECOVERY_ID,deadline=Number(env.LDM_UAT_RECOVERY_EXPIRES);
 if(typeof secret!=='string'||secret.length<20||secret.length>200||!/^[-a-f0-9]{36}$/i.test(request||'')||!Number.isSafeInteger(deadline)||deadline>Date.now()+3600000)throw new Error('Invalid UAT administrator recovery configuration.');
 if(deadline<=Date.now())return false;
 return db.transaction(c.org,async(conn:any)=>{
  const s=createStore(conn,{},{});await accountLock(s,c.org);
  const marker='uat.admin:'+request;
  if(await s.one('SELECT id FROM audit WHERE action=? AND target=?','users:uat-admin-recovered',marker))return false;
  const row=await s.one('SELECT * FROM users WHERE id=? AND org=? FOR UPDATE','uat.admin',c.org);
  if(!row||row.role!=='admin'||!row.active||row.deleted_at||!row.password_enabled)throw new Error('Recovery requires the existing active UAT administrator.');
  const salt=randomBytes(16).toString('hex');
  await s.sql('UPDATE users SET salt=?,hash=?,must_change_password=1,password_expires=?,account_revision=account_revision+1 WHERE id=?',salt,scryptSync(secret,salt,64).toString('hex'),Date.now()+24*3600000,'uat.admin');
  await s.sql('DELETE FROM sessions WHERE user_id=?','uat.admin');
  await s.audit({id:'trusted-uat-recovery',org:c.org},'users:uat-admin-recovered',marker);
  return true;
 });
}
