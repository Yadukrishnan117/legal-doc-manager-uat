import {roles,departments,required,Fault} from './core.ts';
// Trusted operator boundary only. This function is never exposed as an HTTP route.
export async function updateAccess(store:any,org:string,input:any){
 const target=required(input.id,'account ID',100),reason=required(input.reason,'approved access-change reference',500);
 if(!roles.includes(input.role)||!Array.isArray(input.departments)||!input.departments.length||input.departments.some((d:string)=>!departments.includes(d))||typeof input.active!=='boolean')throw new Fault(400,'Explicit approved role, departments and active status are required.');
 const row=await store.one('SELECT * FROM users WHERE id=? AND org=? FOR UPDATE',target,org);if(!row)throw new Fault(404,'Account not found');if(row.deleted_at)throw new Fault(409,'Restore the account before changing access.');
 const team=input.role==='reviewer'?required(input.team,'reviewer team',50):({sales:'Sales',operations:'Operations',legal_manager:'Legal',legal_staff:'Legal',admin:'Administration',auditor:'Audit'} as any)[input.role];
 if(input.role==='reviewer'&&!['Accounts','Software','R&D'].includes(team))throw new Fault(400,'Choose an approved reviewer team.');
 await store.sql('UPDATE users SET role=?,departments=?,active=?,team=?,account_revision=account_revision+1 WHERE id=? AND org=?',input.role,JSON.stringify([...new Set(input.departments)]),input.active?1:0,team,target,org);
 await store.sql('DELETE FROM sessions WHERE user_id=?',target);
 await store.audit({org,id:'trusted-operator'},'user:access-reviewed:'+reason,target);
 return {id:target,role:input.role,active:input.active};
}
