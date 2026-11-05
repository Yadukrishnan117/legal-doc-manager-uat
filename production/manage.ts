// Trusted deployment operator only. Input is read from stdin; no default users.
import {readFileSync} from 'node:fs';
import {configuration} from './runtime.ts';
import {database,migrate} from './database.ts';
import {createStore,roles,departments,required,id} from './core.ts';
import pg from 'pg';
import {updateAccess} from './access.ts';
if(process.argv[2]==='migrate'){
 if(!process.env.MIGRATION_DATABASE_URL||!process.env.DATABASE_CA_FILE)throw new Error('Migration owner URL and verified database CA file required.');
 const client=new pg.Client({connectionString:process.env.MIGRATION_DATABASE_URL,ssl:{ca:readFileSync(process.env.DATABASE_CA_FILE,'utf8'),rejectUnauthorized:true}});await client.connect();
 try{await migrate({query:(q:string)=>client.query(q),exec:(q:string)=>client.query(q)});console.log('Migrations through version 2 applied. Grant the separate runtime role privileges using the deployment guide.')}finally{await client.end()}
}else if(process.argv[2]==='access'){
 const c=configuration(),input=JSON.parse(readFileSync(0,'utf8')),db=await database(c.db);try{await db.transaction(c.org,async conn=>updateAccess(createStore(conn,{},{}),c.org,input));console.log('Approved role, departments and status updated; all account sessions revoked.')}finally{await db.close()}
}else if(process.argv[2]==='user'){
 const c=configuration(),input=JSON.parse(readFileSync(0,'utf8'));
 if(input.org&&input.org!==c.org)throw new Error('This installation is ChargeMOD only.');
 if(!roles.includes(input.role)||!Array.isArray(input.departments)||!input.departments.length||input.departments.some((d:string)=>!departments.includes(d)))throw new Error('Explicit role and departments are required.');
 if(c.production&&!input.googleSubject)throw new Error('Production users require an independently verified Google subject.');
 const db=await database(c.db);
 try{await db.transaction(c.org,async(conn:any)=>{
  const s=createStore(conn,{},{});await s.addUser({...input,org:c.org},c.production?id()+id():required(input.password,'development password',200));
  if(input.googleSubject)await s.sql('INSERT INTO identities VALUES(?,?,?)','https://accounts.google.com',required(input.googleSubject,'verified Google subject',200),input.id);
  await s.audit({id:'trusted-operator',org:c.org},'user:provisioned',input.id);
 });console.log('Named account provisioned. No credentials displayed.')}finally{await db.close()}
}else throw new Error('Use: node production/manage.ts migrate | user | access. User provisioning takes a JSON record through protected stdin.');
