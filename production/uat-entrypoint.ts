import {mkdirSync,chownSync,chmodSync,existsSync,cpSync,renameSync} from 'node:fs';
console.log('UAT startup: entrypoint loaded');
if(process.env.LDM_ENV!=='uat'||process.env.LDM_RUNTIME!=='/data/ldm')throw new Error('This image is restricted to the dedicated UAT volume.');
// Railway mounts volumes as root. Set ownership once, then drop privileges before
// loading the database, accepting requests or processing documents.
if(process.getuid?.()===0){
 chownSync('/data',1000,1000);chmodSync('/data',0o700);mkdirSync('/data/ldm',{recursive:true,mode:0o700});chownSync('/data/ldm',1000,1000);
 process.setgid!(1000);process.setuid!(1000);
}
console.log('UAT startup: private volume ready; runtime privileges dropped');
// A fresh initdb peaks above the UAT plan's memory cap. The image includes only
// a migrated, empty database; each workspace copies it once before bootstrap.
// Atomic rename prevents a partial copy from being treated as an initialized DB.
const databasePath='/data/ldm/postgres-uat-v1';
if(!existsSync(databasePath)){
 const staging=databasePath+'.prepare-'+process.pid;
 cpSync('/app/uat-empty',staging,{recursive:true,errorOnExist:true,force:false});
 renameSync(staging,databasePath);
}
// Preserve a private, closed-database snapshot before migration 3 is first run.
// Railway's single attached volume is handed over after the old container stops.
const beforeRecovery='/data/ldm/backups/before-recovery-codes';
if(!existsSync(beforeRecovery)){
 mkdirSync('/data/ldm/backups',{recursive:true,mode:0o700});
 const staging=beforeRecovery+'.prepare-'+process.pid;
 cpSync(databasePath,staging,{recursive:true,errorOnExist:true,force:false});
 renameSync(staging,beforeRecovery);
}
const {startRuntime}=await import('./runtime.ts');
await startRuntime();
