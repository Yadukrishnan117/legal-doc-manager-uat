import {randomBytes,scryptSync,timingSafeEqual} from 'node:crypto';
import {Fault,digest,required} from './core.ts';
import {accountLock} from './users.ts';
const assert=(ok:any,status:number,message:string)=>{if(!ok)throw new Fault(status,message)};
const codeHash=(uid:string,code:string)=>digest('ldm-recovery:'+uid+':'+code.replace(/[\s-]/g,'').toUpperCase());
const enabled=(options:any)=>options.uat===true&&!options.production&&options.passwordLogin===true;
function ownAdmin(actor:any){assert(actor?.role==='admin'&&actor.active&&!actor.deleted_at,403,'Administrator access is required.');}
export async function recoveryCodeStatus(store:any,actor:any,options:any){
 assert(enabled(options),403,'Password recovery codes are available only in UAT.');ownAdmin(actor);
 const row=await store.one('SELECT recovery_codes FROM users WHERE id=?',actor.id);
 return {remaining:JSON.parse(row.recovery_codes).length};
}
export async function generateRecoveryCodes(store:any,actor:any,input:any,options:any){
 assert(enabled(options),403,'Password recovery codes are available only in UAT.');ownAdmin(actor);await accountLock(store,actor.org);
 const row=await store.one('SELECT * FROM users WHERE id=? FOR UPDATE',actor.id);
 assert(row&&row.active&&!row.deleted_at&&row.role==='admin'&&row.password_enabled&&!row.must_change_password,403,'Set your own password before enabling recovery.');
 const password=required(input.currentPassword,'current password',200);
 assert(timingSafeEqual(scryptSync(password,row.salt,64),Buffer.from(row.hash,'hex')),403,'Current password was not accepted.');
 const codes=Array.from({length:10},()=> 'LDM-'+randomBytes(20).toString('hex').toUpperCase().match(/.{1,5}/g)!.join('-'));
 await store.sql('UPDATE users SET recovery_codes=? WHERE id=?',JSON.stringify(codes.map(code=>codeHash(row.id,code))),row.id);
 await store.audit(actor,'recovery-codes:generated',row.id);
 return {codes,remaining:codes.length};
}
export async function resetWithRecoveryCode(store:any,input:any,options:any){
 assert(enabled(options),403,'Use your company identity provider for password recovery.');
 const uid=required(input.user,'account ID',100),code=required(input.code,'recovery code',100),next=required(input.newPassword,'new password',200);
 assert(next.length>=14,400,'Use a unique password of 14–200 characters.');
 await accountLock(store,options.org);
 const row=await store.one('SELECT * FROM users WHERE id=? AND org=? FOR UPDATE',uid,options.org);
 const hashes=JSON.parse(row?.recovery_codes||'[]'),hash=codeHash(uid,code);
 const match=hashes.findIndex((value:string)=>timingSafeEqual(Buffer.from(value,'hex'),Buffer.from(hash,'hex')));
 assert(row&&row.active&&!row.deleted_at&&row.role==='admin'&&row.password_enabled&&match>=0,400,'The account or recovery code could not be verified. Use an unused saved code.');
 assert(!timingSafeEqual(scryptSync(next,row.salt,64),Buffer.from(row.hash,'hex')),400,'Choose a password different from your current password.');
 hashes.splice(match,1);const salt=randomBytes(16).toString('hex');
 await store.sql('UPDATE users SET salt=?,hash=?,must_change_password=0,password_expires=NULL,recovery_codes=?,account_revision=account_revision+1 WHERE id=?',salt,scryptSync(next,salt,64).toString('hex'),JSON.stringify(hashes),uid);
 await store.sql('DELETE FROM sessions WHERE user_id=?',uid);
 await store.audit({id:uid,org:options.org},'password:recovered-with-code',uid);
 return {ok:true,message:'Password reset. Sign in with your new password. This recovery code has been used.'};
}
