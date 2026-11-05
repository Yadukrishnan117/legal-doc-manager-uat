// Trusted local operator command. No default roles, accounts or passwords.
import {createInterface} from 'node:readline/promises';
import {readFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {createStore,roles,departments,required} from './core.ts';
if(!process.stdin.isTTY)throw new Error('Use an interactive terminal. For managed input use manage.ts with protected stdin.');
const rl=createInterface({input:process.stdin,output:process.stdout});
function hidden(prompt:string):Promise<string>{process.stdout.write(prompt);return new Promise((resolve,reject)=>{let value='';process.stdin.setRawMode(true);process.stdin.resume();const cleanup=()=>{process.stdin.off('data',onData);process.stdin.setRawMode(false);process.stdout.write('\n')};const onData=(chunk:Buffer)=>{for(const c of chunk.toString()){if(c==='\u0003'){cleanup();reject(new Error('Cancelled'));return}if(c==='\r'||c==='\n'){cleanup();resolve(value);return}if(c==='\u007f'){value=value.slice(0,-1)}else if(c.charCodeAt(0)>=32)value+=c}};process.stdin.on('data',onData)})}
let store:any;
try{
 const id=required(await rl.question('Account ID (unique employee ID or business email): '),'account ID',100);
 const org=required(await rl.question('Organization ID (same value for colleagues): '),'organization',100);
 const name=required(await rl.question('Display name: '),'name',100);
 console.log('Roles: '+roles.join(', '));
 const role=required(await rl.question('Explicit approved role: '),'role',40);if(!roles.includes(role))throw new Error('Choose a listed role.');
 console.log('Departments: '+departments.join(' | '));
 const ds=(await rl.question('Approved departments, separated by | : ')).split('|').map(s=>s.trim()).filter(Boolean);if(!ds.length||ds.some(d=>!departments.includes(d)))throw new Error('Choose listed departments.');
 const team=role==='reviewer'?(await rl.question('Functional team (Accounts, Software or R&D): ')).trim():undefined;if(role==='reviewer'&&!['Accounts','Software','R&D'].includes(team||''))throw new Error('Choose an approved functional team.');
 const subject=(await rl.question('Independently verified Google subject (leave blank until verified): ')).trim();
 console.log('About to provision '+id+' as '+role+' in '+org+'. Administrator has no default document access.');
 if((await rl.question('Type PROVISION to confirm this account/role: '))!=='PROVISION')throw new Error('Cancelled.');
 rl.close();
 const password=await hidden('Unique local development password (14+ characters; hidden): ');const repeat=await hidden('Repeat password (hidden): ');if(password!==repeat)throw new Error('Passwords did not match.');
 const root=resolve(process.env.LDM_RUNTIME||'backend/.runtime'),config=JSON.parse(readFileSync(root+'/config.json','utf8'));
 store=createStore(root+'/legal.sqlite',Buffer.from(config.key,'hex'));store.addUser({id,org,name,role,departments:ds,team},password);
 if(subject)store.sql('INSERT INTO identities VALUES(?,?,?)','https://accounts.google.com',subject,id);
 store.audit({org,id:'local-operator'},'user:provisioned',id);
 console.log('Account provisioned. No secret displayed. Google Workspace access still requires configured OAuth and an approved subject mapping.');
}catch(e:any){console.error(e.message);process.exitCode=1}finally{rl.close();store?.db.close();process.stdin.pause()}
