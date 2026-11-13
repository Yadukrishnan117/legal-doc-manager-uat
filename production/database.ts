import pg from 'pg';

import {readFileSync} from 'node:fs';

// Workflow queries use positional ?, translated before reaching PostgreSQL.
export function statement(query:string){let n=0,quoted=false;let result='';for(let i=0;i<query.length;i++){const c=query[i];if(c==="'"){if(quoted&&query[i+1]==="'"){result+="''";i++;continue}quoted=!quoted}result+=c==='?'&&!quoted?'$'+(++n):c}if(result.startsWith('INSERT OR IGNORE INTO '))result=result.replace('INSERT OR IGNORE INTO ','INSERT INTO ')+' ON CONFLICT DO NOTHING';return result}
export async function migrate(db:any){
 await db.exec('BEGIN');try{
  await db.exec('CREATE TABLE IF NOT EXISTS schema_migrations(version INTEGER PRIMARY KEY, applied_at TIMESTAMPTZ NOT NULL DEFAULT now())');
  const prior=await db.query('SELECT version FROM schema_migrations WHERE version=1');
  if(!prior.rows.length){await db.exec(readFileSync(new URL('./001-schema.sql',import.meta.url),'utf8'));await db.exec('INSERT INTO schema_migrations(version) VALUES(1)')}
  const management=await db.query('SELECT version FROM schema_migrations WHERE version=2');
  if(!management.rows.length){await db.exec(readFileSync(new URL('./002-user-management.sql',import.meta.url),'utf8'));await db.exec('INSERT INTO schema_migrations(version) VALUES(2)')}
  const recovery=await db.query('SELECT version FROM schema_migrations WHERE version=3');
  if(!recovery.rows.length){await db.exec(readFileSync(new URL('./003-recovery-codes.sql',import.meta.url),'utf8'));await db.exec('INSERT INTO schema_migrations(version) VALUES(3)')}
  await db.exec('COMMIT');
 }catch(e){await db.exec('ROLLBACK');throw e}
}
export async function database(config:any){
 if(config.mode!=='production'){
  const {PGlite}=await import('@electric-sql/pglite');
  const engine=new PGlite(config.path);
  await engine.waitReady;await migrate(engine);
  await engine.exec("DO $$ BEGIN IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname='ldm_app') THEN CREATE ROLE ldm_app NOLOGIN; END IF; END $$; GRANT USAGE ON SCHEMA public TO ldm_app; GRANT SELECT,INSERT,UPDATE,DELETE ON ALL TABLES IN SCHEMA public TO ldm_app; GRANT USAGE,SELECT ON ALL SEQUENCES IN SCHEMA public TO ldm_app; REVOKE UPDATE,DELETE ON audit FROM ldm_app;");
  return {kind:'embedded-postgresql',async transaction(org:string,fn:any){return engine.transaction(async c=>{await c.query("SELECT set_config('app.org',$1,true)",[org]);await c.exec('SET LOCAL ROLE ldm_app');return fn({query:(q:string,p:any[]=[])=>c.query(statement(q),p)})})},close:()=>engine.close(),engine};
 }
 if(!config.url||!config.ca)throw new Error('Production PostgreSQL requires DATABASE_URL and DATABASE_CA_FILE.');
 const pool=new pg.Pool({connectionString:config.url,ssl:{ca:readFileSync(config.ca,'utf8'),rejectUnauthorized:true},max:12,connectionTimeoutMillis:10000,idleTimeoutMillis:30000});
 const check=await pool.query("SELECT rolsuper,rolbypassrls FROM pg_roles WHERE rolname=current_user");
 if(check.rows[0].rolsuper||check.rows[0].rolbypassrls){await pool.end();throw new Error('Runtime PostgreSQL account must not be superuser or bypass RLS.')}
 const owner=await pool.query("SELECT 1 FROM pg_tables WHERE schemaname='public' AND tableowner=current_user LIMIT 1");if(owner.rows.length){await pool.end();throw new Error('Use a separate migration owner; runtime account must not own tables.')}
 const schema=await pool.query('SELECT version FROM schema_migrations WHERE version IN (1,2,3)');if(schema.rows.length!==3){await pool.end();throw new Error('Apply the production database migration before startup.');}
 return {kind:'postgresql',async transaction(org:string,fn:any){const c=await pool.connect();try{await c.query('BEGIN');await c.query("SELECT set_config('app.org',$1,true)",[org]);await c.query("SET LOCAL statement_timeout='15s'");await c.query("SET LOCAL lock_timeout='5s'");const result=await fn({query:(q:string,p:any[]=[])=>c.query(statement(q),p)});await c.query('COMMIT');return result}catch(e){await c.query('ROLLBACK');throw e}finally{c.release()}},close:()=>pool.end()};
}
