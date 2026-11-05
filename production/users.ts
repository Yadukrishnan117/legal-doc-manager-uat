import {randomBytes,scryptSync,timingSafeEqual} from 'node:crypto';
import {roles,departments,Fault,required,now,id} from './core.ts';
const teamFor=(role:string,team:any)=>role==='reviewer'?team:({sales:'Sales',operations:'Operations',legal_manager:'Legal',legal_staff:'Legal',admin:'Administration',auditor:'Audit'} as any)[role];
const assert=(ok:any,status:number,message:string)=>{if(!ok)throw new Fault(status,message)};
export async function accountLock(store:any,org:string){await store.sql('INSERT INTO account_controls(org) VALUES(?) ON CONFLICT DO NOTHING',org);await store.one('SELECT org FROM account_controls WHERE org=? FOR UPDATE',org)}
function admin(actor:any){assert(actor?.role==='admin'&&actor.active&&!actor.deleted_at,403,'Administrator access is required.')}
function grants(input:any){assert(roles.includes(input.role)&&Array.isArray(input.departments)&&input.departments.length&&input.departments.every((d:any)=>departments.includes(d)),400,'Choose an approved role and at least one business department.');const team=teamFor(input.role,input.team);assert(input.role!=='reviewer'||['Accounts','Software','R&D'].includes(team),400,'Choose Accounts, Software or R&D for the review team.');return team}
function password(value:any){assert(typeof value==='string'&&value.length>=14&&value.length<=200,400,'Use a unique password of 14–200 characters.');return value}
function temporary(){return 'Ldm!'+randomBytes(15).toString('base64url')}
async function target(store:any,actor:any,uid:string){const row=await store.one('SELECT * FROM users WHERE id=? AND org=? FOR UPDATE',uid,actor.org);assert(row,404,'Account not found.');return row}
function reason(input:any){return required(input.reason,'reason for this account change',500)}
function revision(row:any,input:any){assert(input.revision===row.account_revision,409,'This account changed. Refresh the directory and try again.')}
function independent(actor:any,uid:string){assert(actor.id!==uid,409,'Use another administrator to change your own role, status or account. Change your password from your account menu.')}
async function retainAdmin(store:any,actor:any,row:any,nextRole:string,nextActive:boolean){if(row.role==='admin'&&row.active&&(nextRole!=='admin'||!nextActive)){const count=await store.one("SELECT count(*) n FROM users WHERE org=? AND role='admin' AND active=1 AND deleted_at IS NULL",actor.org);assert(Number(count.n)>1,409,'Keep at least one active administrator in this workspace.')}}
async function log(store:any,actor:any,action:string,uid:string,note:string){await store.audit(actor,action,uid); // Exclude passwords and identity subjects from audit payloads.
 await store.audit(actor,'users:change-reference',uid+':'+note);
}
export async function userDirectory(store:any,actor:any){admin(actor);await store.audit(actor,'users:list','users');return store.all(`SELECT u.id,u.name,u.role,u.departments,u.team,u.active,u.deleted_at,u.password_enabled,u.must_change_password,u.password_expires,u.account_revision,
 (SELECT count(*)::int FROM sessions s WHERE s.user_id=u.id AND s.expires>? AND s.last_seen>?) AS sessions,
 EXISTS(SELECT 1 FROM identities i WHERE i.user_id=u.id) AS google_linked
 FROM users u WHERE u.org=? ORDER BY u.deleted_at NULLS FIRST,u.name`,Date.now(),Date.now()-1800000,actor.org)}
export async function createUser(store:any,actor:any,input:any,localPasswords:boolean){
 admin(actor);await accountLock(store,actor.org);const uid=required(input.id,'account ID',100),name=required(input.name,'display name',100),team=grants(input),note=reason(input);assert(/^[a-zA-Z0-9@._-]{1,100}$/.test(uid),400,'Account IDs can contain letters, numbers, @, dot, underscore and hyphen.');
 assert(!await store.one('SELECT id FROM users WHERE id=?',uid),409,'This account ID is already reserved. Use another ID or restore the removed account.');
 if(!localPasswords)assert(typeof input.googleSubject==='string'&&input.googleSubject.trim()&&input.identityVerified===true,400,'Verify and link the employee’s Google identity before creating this SSO account.');
 if(input.googleSubject){assert(input.identityVerified===true,400,'Confirm independent verification of the Google identity.');const other=await store.one('SELECT user_id FROM identities WHERE issuer=? AND subject=?','https://accounts.google.com',input.googleSubject.trim());assert(!other,409,'This Google identity is already linked to an account.')}
 const secret=localPasswords?temporary():null;
 await store.addUser({id:uid,org:actor.org,name,role:input.role,departments:[...new Set(input.departments)],team},secret||id()+id());
 const expires=localPasswords?Date.now()+24*3600000:null;
 await store.sql('UPDATE users SET password_enabled=?,must_change_password=?,password_expires=? WHERE id=?',localPasswords?1:0,localPasswords?1:0,expires,uid);
 if(input.googleSubject)await store.sql('INSERT INTO identities VALUES(?,?,?)','https://accounts.google.com',input.googleSubject.trim(),uid);
 await log(store,actor,'users:created',uid,note);return {id:uid,temporaryPassword:secret,expiresAt:expires,mustChangePassword:!!secret};
}
export async function editUser(store:any,actor:any,uid:string,input:any){
 admin(actor);await accountLock(store,actor.org);independent(actor,uid);const row=await target(store,actor,uid);assert(!row.deleted_at,409,'Restore this removed account before editing it.');revision(row,input);const note=reason(input);
 // Status-only updates remain compatible with the previous dashboard/API.
 const role=input.role??row.role,ds=input.departments??JSON.parse(row.departments),team=grants({role,departments:ds,team:input.team??row.team});const active=input.active??!!row.active;
 assert(typeof active==='boolean',400,'Choose an explicit account status.');assert(Object.keys(input).every(k=>['name','role','departments','team','active','reason','revision'].includes(k)),400,'Unsupported account field.');
 await retainAdmin(store,actor,row,role,active);
 await store.sql('UPDATE users SET name=?,role=?,departments=?,team=?,active=?,account_revision=account_revision+1 WHERE id=?',input.name===undefined?row.name:required(input.name,'display name',100),role,JSON.stringify([...new Set(ds)]),team,active?1:0,uid);
 await store.sql('DELETE FROM sessions WHERE user_id=?',uid);await log(store,actor,'users:updated',uid,note);return {id:uid,active,role};
}
export async function removeUser(store:any,actor:any,uid:string,input:any){
 admin(actor);await accountLock(store,actor.org);independent(actor,uid);const row=await target(store,actor,uid);revision(row,input);assert(!row.deleted_at,409,'This account is already removed.');const note=reason(input);await retainAdmin(store,actor,row,row.role,false);
 await store.sql('UPDATE users SET active=0,deleted_at=?,password_enabled=0,must_change_password=0,password_expires=NULL,hash=?,account_revision=account_revision+1 WHERE id=?',now(),randomBytes(64).toString('hex'),uid);
 await store.sql('DELETE FROM sessions WHERE user_id=?',uid);await store.sql('DELETE FROM identities WHERE user_id=?',uid);await log(store,actor,'users:removed',uid,note);return {id:uid,removed:true,message:'Account removed and sign-in revoked. Agreement ownership and audit history are preserved.'};
}
export async function userCredentials(store:any,actor:any,uid:string,input:any,localPasswords:boolean){
 admin(actor);await accountLock(store,actor.org);independent(actor,uid);const row=await target(store,actor,uid);revision(row,input);const note=reason(input);
 if(input.action==='restore'){assert(row.deleted_at,409,'This account has not been removed.');await store.sql('UPDATE users SET deleted_at=NULL,active=0,account_revision=account_revision+1 WHERE id=?',uid);await log(store,actor,'users:restored-disabled',uid,note);return {id:uid,message:'Restored as disabled. Review access and issue credentials before activation.'}}
 assert(!row.deleted_at,409,'Restore the account before managing its credentials.');
 let secret=null,expires=null;
 if(input.action==='reset-password'){
  assert(localPasswords,403,'Production passwords are managed through Google Workspace.');assert(row.active,409,'Activate this account before issuing a temporary password.');secret=temporary();expires=Date.now()+24*3600000;const salt=randomBytes(16).toString('hex');
  await store.sql('UPDATE users SET salt=?,hash=?,password_enabled=1,must_change_password=1,password_expires=? WHERE id=?',salt,scryptSync(secret,salt,64).toString('hex'),expires,uid);
 }else if(input.action==='link-google'){
  assert(input.identityVerified===true,400,'Confirm independent verification of the Google identity.');const subject=required(input.googleSubject,'verified Google subject',200);const existing=await store.one('SELECT user_id FROM identities WHERE issuer=? AND subject=?','https://accounts.google.com',subject);assert(!existing||existing.user_id===uid,409,'This Google identity is already linked to another account.');await store.sql('DELETE FROM identities WHERE user_id=?',uid);await store.sql('INSERT INTO identities VALUES(?,?,?)','https://accounts.google.com',subject,uid);
 }else if(input.action==='unlink-google'){await store.sql('DELETE FROM identities WHERE user_id=?',uid)}
 else assert(input.action==='revoke-sessions',400,'Choose an available credential action.');
 await store.sql('DELETE FROM sessions WHERE user_id=?',uid);await store.sql('UPDATE users SET account_revision=account_revision+1 WHERE id=?',uid);await log(store,actor,'users:'+input.action,uid,note);return {id:uid,temporaryPassword:secret,expiresAt:expires,message:'Credential action completed. Existing sessions have been revoked.'};
}
export async function changePassword(store:any,actor:any,input:any,localPasswords:boolean){
 assert(localPasswords,403,'Production passwords are managed through Google Workspace.');await accountLock(store,actor.org);const row=await target(store,actor,actor.id);assert(row.active&&!row.deleted_at&&row.password_enabled,403,'Password sign-in is unavailable for this account.');
 const old=password(input.currentPassword),next=password(input.newPassword);assert(old!==next,400,'Choose a new password different from the temporary or current password.');assert(timingSafeEqual(scryptSync(old,row.salt,64),Buffer.from(row.hash,'hex')),403,'Current password was not accepted.');const salt=randomBytes(16).toString('hex');
 await store.sql('UPDATE users SET salt=?,hash=?,must_change_password=0,password_expires=NULL,account_revision=account_revision+1 WHERE id=?',salt,scryptSync(next,salt,64).toString('hex'),actor.id);await store.sql('DELETE FROM sessions WHERE user_id=?',actor.id);await store.audit(actor,'password:changed',actor.id);return {ok:true,message:'Password updated. Sign in again with your new password.'};
}
