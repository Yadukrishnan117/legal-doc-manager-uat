import {mkdirSync,chownSync,chmodSync} from 'node:fs';
import {startRuntime} from './runtime.ts';
if(process.env.LDM_ENV!=='uat'||process.env.LDM_RUNTIME!=='/data/ldm')throw new Error('This image is restricted to the dedicated UAT volume.');
// Railway mounts volumes as root. Set ownership once, then drop privileges before
// loading the database, accepting requests or processing documents.
if(process.getuid?.()===0){
 chownSync('/data',1000,1000);chmodSync('/data',0o700);mkdirSync('/data/ldm',{recursive:true,mode:0o700});chownSync('/data/ldm',1000,1000);
 process.setgid!(1000);process.setuid!(1000);
}
await startRuntime();
