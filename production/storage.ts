import {S3Client,PutObjectCommand,GetObjectCommand,GetPublicAccessBlockCommand,GetBucketLocationCommand,GetBucketEncryptionCommand} from '@aws-sdk/client-s3';
import {mkdir,writeFile,readFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {randomBytes} from 'node:crypto';
import net from 'node:net';
import {vault,Fault} from './core.ts';

export function objectStorage(config:any){
 const crypt=vault(config.key),prefix='chargemod/objects/';
 const client=config.bucket?new S3Client({region:'ap-south-1',maxAttempts:3,requestHandler:{connectionTimeout:5000,requestTimeout:15000},...(config.endpoint?{endpoint:config.endpoint,forcePathStyle:true}:{}),...(config.credentials?{credentials:config.credentials}:{})}):null;
 function valid(ref:string){if(!new RegExp('^'+prefix+'[a-f0-9]{64}$').test(ref))throw new Error('Invalid private object reference');return ref}
 return {
  kind:client?'private-s3-kms':'encrypted-local-files',
  async assertReady(){
   if(!client){if(config.production)throw new Error('Production requires private S3 storage');await mkdir(config.directory,{recursive:true,mode:0o700});return}
   const [access,location,encryption]=await Promise.all([client.send(new GetPublicAccessBlockCommand({Bucket:config.bucket})),client.send(new GetBucketLocationCommand({Bucket:config.bucket})),client.send(new GetBucketEncryptionCommand({Bucket:config.bucket}))]);
   if(!Object.values(access.PublicAccessBlockConfiguration||{}).every(v=>v===true)||Object.keys(access.PublicAccessBlockConfiguration||{}).length!==4)throw new Error('S3 must block all public access');
   if(location.LocationConstraint!=='ap-south-1')throw new Error('S3 bucket must use the approved Mumbai region');
   const rule=encryption.ServerSideEncryptionConfiguration?.Rules?.[0]?.ApplyServerSideEncryptionByDefault;
   if(rule?.SSEAlgorithm!=='aws:kms'||rule.KMSMasterKeyID!==config.kmsKey)throw new Error('S3 default encryption must use the configured KMS key ARN');
  },
  async put(bytes:Buffer){const ref=prefix+randomBytes(32).toString('hex'),sealed=crypt.seal(bytes);if(client)await client.send(new PutObjectCommand({Bucket:config.bucket,Key:ref,Body:sealed,ContentType:'application/octet-stream',ServerSideEncryption:'aws:kms',SSEKMSKeyId:config.kmsKey,IfNoneMatch:'*'}));else {await mkdir(config.directory,{recursive:true,mode:0o700});await writeFile(resolve(config.directory,ref.split('/').at(-1)!),sealed,{flag:'wx',mode:0o600})}return ref},
  async get(reference:string){const ref=valid(reference);let bytes;if(client){const result=await client.send(new GetObjectCommand({Bucket:config.bucket,Key:ref}));bytes=Buffer.from(await result.Body!.transformToByteArray())}else bytes=await readFile(resolve(config.directory,ref.split('/').at(-1)!));return crypt.open(bytes)}
 };
}
export function clamAV(config:any){
 if(!config.host){if(config.production)throw new Error('Production requires a private ClamAV service');return {kind:'development-only',async scan(bytes:Buffer){if(bytes.includes(Buffer.from('EICAR-STANDARD-ANTIVIRUS-TEST-FILE')))throw new Fault(422,'File rejected by development scanner')} ,async assertReady(){}}}
 async function command(data:Buffer){return new Promise<string>((resolve,reject)=>{const socket=net.createConnection({host:config.host,port:Number(config.port||3310)});let result=Buffer.alloc(0);socket.setTimeout(15000);socket.on('connect',()=>socket.write(data));socket.on('data',chunk=>{result=Buffer.concat([result,chunk]);if(result.length>4096){socket.destroy();reject(new Error('Invalid scanner response'))}else if(result.includes(0)){socket.end();resolve(result.toString().replace(/\0/g,''))}});socket.on('timeout',()=>socket.destroy(new Error('Scanner timed out')));socket.on('error',reject);socket.on('end',()=>{if(!result.includes(0))reject(new Error('Scanner unavailable'))})})}
 return {kind:'clamav',async assertReady(){const r=await command(Buffer.from('zVERSION\0'));if(!r.startsWith('ClamAV '))throw new Error('Scanner is not ready')},async scan(bytes:Buffer){const length=Buffer.alloc(4);length.writeUInt32BE(bytes.length);let answer;try{answer=await command(Buffer.concat([Buffer.from('zINSTREAM\0'),length,bytes,Buffer.alloc(4)]))}catch{throw new Fault(503,'File checking is unavailable. No document was accepted.')}if(answer!=='stream: OK')throw new Fault(422,'File was rejected by security checking. Contact your administrator.')}}
}

// Isolated UAT accepts plain-text fixtures only; it does not claim antivirus coverage.
// Production always uses the separately configured ClamAV adapter.
export function uatTextScanner(){return {kind:'uat-plain-text-only',async assertReady(){},async scan(bytes:Buffer){
 if(!bytes.length||bytes.length>200*1024)throw new Fault(413,'UAT TXT fixtures must be between 1 byte and 200 KB.');
 let text:string;try{text=new TextDecoder('utf-8',{fatal:true}).decode(bytes)}catch{throw new Fault(422,'UAT accepts fictional UTF-8 TXT documents only.')}
 if(/%PDF-|EICAR-STANDARD-ANTIVIRUS-TEST-FILE|[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/.test(text))throw new Fault(422,'UAT accepts fictional plain-text fixtures only. PDF, binary and unsafe test files are blocked.');
 }}}
