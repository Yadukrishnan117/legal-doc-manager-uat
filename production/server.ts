import http from 'node:http';
import { readFileSync, mkdirSync, existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { randomBytes, createHmac, timingSafeEqual } from 'node:crypto';
import { createStore, Fault, fail, digest, id, now, required } from './core.ts';
import { googleOIDC } from './oidc.ts';
import {accountLock,userDirectory,createUser,editUser,removeUser,userCredentials,changePassword} from './users.ts';
export function createApplication(options: any) {
    const { origin, google = {}, integration = {} } = options;
    google.org=options.org;
    if(integration.org&&integration.org!==options.org)throw new Error('Integration organization must match this workspace');
    const secure = origin.startsWith('https:'), sessionName=secure?'__Host-ldm_session':'ldm_session', stateName=secure?'__Host-ldm_oidc':'ldm_oidc', oidc = googleOIDC(google, options.key);
    const cookie = (name: string, value: string, age: number, strict = true) => `${name}=${value}; HttpOnly; SameSite=${strict ? 'Strict' : 'Lax'}; Path=/; Max-Age=${age}${secure ? '; Secure' : ''}`;
    async function handle(req: any, res: any, store: any) {
        const url = new URL(req.url || '/', origin);
        let actor: any = null;
        const json = (status: number, data: any) => { res.writeHead(status, { 'Content-Type': 'application/json' }); res.end(JSON.stringify(data)); };
        res.setHeader('Cache-Control', 'no-store');
        res.setHeader('X-Content-Type-Options', 'nosniff');
        res.setHeader('Referrer-Policy', 'no-referrer');
        res.setHeader('X-Frame-Options', 'DENY');
        res.setHeader('Content-Security-Policy', "default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data:; object-src 'none'; frame-ancestors 'none'; base-uri 'none'; form-action 'self'");
        if (secure)
            res.setHeader('Strict-Transport-Security', 'max-age=31536000');
        const cookies = Object.fromEntries((req.headers.cookie || '').split(';').filter(Boolean).map(x => x.trim().split('=')));
        try {
            if (req.headers.host !== new URL(origin).host && !(options.uat&&req.headers.host==='healthcheck.railway.app'&&req.method==='GET'&&['/health/live','/health/ready'].includes(url.pathname)))
                fail(403, 'Unexpected host');
            
            let b: any = {}, rawBody = '';
            if (!['GET', 'HEAD'].includes(req.method || '')) {
                let length = 0;
                const chunks = [];
                for await (const chunk of req) {
                    length += chunk.length;
                    if (length > 3 * 1024 * 1024)
                        fail(413, 'Request exceeds 3 MB');
                    chunks.push(chunk);
                }
                rawBody = Buffer.concat(chunks).toString();
                try {
                    b = JSON.parse(rawBody || '{}');
                }
                catch {
                    fail(400, 'Expected JSON request');
                }
                if (!b || Array.isArray(b) || typeof b !== 'object')
                    fail(400, 'Expected JSON object');
            }
            if (url.pathname === '/api/auth/config' && req.method === 'GET')
                return json(200, { workspace: 'ChargeMOD', passwordLogin: options.passwordLogin === true && !options.production, googleConfigured: !!(google.clientId && google.clientSecret && google.domain && google.redirectUri), production: options.production === true, uat:options.uat===true });
            if (url.pathname === '/health/live')
                return json(200, { status: 'ok' });
            if (url.pathname === '/health/ready') {
                await store.one('SELECT 1');
                return json(200, { status: 'ready' });
            }
            if (url.pathname === '/api/integration/events' && req.method === 'POST') {
                if (!integration.secret || !integration.org || !integration.source)
                    fail(503, 'Integration identity not configured');
                const timestamp = String(req.headers['x-event-timestamp'] || ''), sig = String(req.headers['x-event-signature'] || ''), payload = rawBody;
                if (Math.abs(Date.now() - Number(timestamp)) > 300000 || !/^\d+$/.test(timestamp) || !/^[a-f0-9]{64}$/.test(sig))
                    fail(401, 'Invalid integration signature');
                const expected = createHmac('sha256', integration.secret).update(timestamp + '.' + payload).digest();
                if (!timingSafeEqual(Buffer.from(sig, 'hex'), expected))
                    fail(401, 'Invalid integration signature');
                if (!['lead.created', 'deal.closed'].includes(b.type))
                    fail(400, 'Unsupported event');
                const ext = required(b.externalId, 'external record ID', 100), eid = required(b.eventId, 'event ID', 100), hash = digest(payload);
                const prior = await store.one('SELECT * FROM integration_events WHERE source=? AND external_id=? AND event_id=?', integration.source, ext, eid);
                if (prior) {
                    if (prior.digest !== hash)
                        fail(409, 'Event ID reused with changed payload');
                    return json(200, { status: 'already_received', eventId: eid });
                }
                await store.sql('INSERT INTO integration_events VALUES(?,?,?,?,?,?,?)', integration.source, ext, eid, hash, integration.org, null, now());
                await store.audit({ org: integration.org, id: 'integration:' + integration.source }, 'integration:accepted', eid);
                return json(202, { status: 'pending_mapping_review', eventId: eid, message: 'Envelope accepted; no legal ticket created until mapping adapter is implemented.' });
            }
            if (req.method === 'GET' && url.pathname === '/auth/google') {
                const start = await oidc.start(store);
                res.setHeader('Set-Cookie', cookie(stateName, start.state, 300, false));
                res.writeHead(302, { Location: start.url });
                res.end();
                return;
            }
            if (req.method === 'GET' && url.pathname === '/auth/google/callback') {
                const claims = await oidc.finish(url.searchParams.get('state') || '', url.searchParams.get('code') || '', cookies[stateName] || '', store);
                const identity = await store.one('SELECT user_id FROM identities WHERE issuer=? AND subject=?', 'https://accounts.google.com', claims.sub);
                if (!identity)
                    fail(403, 'This Workspace identity has not been provisioned by your administrator.');
                const u = await store.user(identity.user_id);
                if (!u?.active)
                    fail(403, 'Account is inactive');
                const token = randomBytes(32).toString('base64url'), csrf = randomBytes(24).toString('base64url');
                await store.sql("INSERT INTO sessions(token_hash,user_id,csrf,expires,auth_method) VALUES(?,?,?,?,'google')", digest(token), u.id, csrf, Date.now() + 8 * 3600000);
                await store.audit(u, 'google:login', u.id);
                res.setHeader('Set-Cookie', [cookie(sessionName, token, 28800), cookie(stateName, '', 0, false)]);
                res.writeHead(302, { Location: '/' });
                res.end();
                return;
            }
            if (req.method === 'POST' && url.pathname === '/api/login') {
                if (req.headers.origin !== origin)
                    fail(403, 'Same-origin request required');
                if (options.passwordLogin !== true || options.production)
                    fail(403, 'Use Google Workspace sign-in');
                
                const session = await store.login(required(b.user, 'account', 100), required(b.password, 'password', 200));
                res.setHeader('Set-Cookie', cookie(sessionName, session.token, 28800));
                return json(200, { user: session.user, csrf: session.csrf });
            }
            if (url.pathname.startsWith('/api/')) {
                if(!['GET','HEAD'].includes(req.method||'')&&(url.pathname.startsWith('/api/users')||url.pathname==='/api/password'))await accountLock(store,options.org);
                const session = await store.session(cookies[sessionName] || '');
                if (!session) {
                    await store.audit({ id: 'anonymous', org: options.org }, 'http:unauthenticated', url.pathname, 'deny');
                    fail(401, 'Sign in to continue');
                }
                ;
                actor = session.user;res.actor=actor;
                if (!['GET', 'HEAD'].includes(req.method || '') && (req.headers.origin !== origin || req.headers['x-csrf-token'] !== session.csrf))
                    fail(403, 'Request verification failed. Refresh and retry.');
                const u = actor, p = url.pathname, m = req.method;
                const localPasswords=options.passwordLogin===true&&!options.production;
                if(u.mustChangePassword&&!['/api/me','/api/logout','/api/password'].includes(p))fail(403,'Change your temporary password before entering the workspace.');
                if(p==='/api/password'&&m==='POST'){const result=await changePassword(store,u,b,localPasswords);res.setHeader('Set-Cookie',cookie(sessionName,'',0));return json(200,result)}
                if (p === '/api/templates' && m === 'GET')
                    return json(200, await store.templateList(u, url.searchParams.get('department') || ''));
                if (p === '/api/templates' && m === 'POST')
                    return json(201, await store.templateCreate(u, b));
                const libraryRoute = p.match(/^\/api\/templates\/([a-f0-9]+)\/(versions|publish|download|start)$/);
                if (libraryRoute) {
                    const [, tid, action] = libraryRoute;
                    if (m === 'POST' && action === 'versions')
                        return json(201, await store.templateUpload(u, tid, b));
                    if (m === 'POST' && action === 'publish')
                        return json(200, await store.templatePublish(u, tid, b));
                    if (m === 'POST' && action === 'start')
                        return json(201, await store.fromTemplate(u, tid, b));
                    if (m === 'GET' && action === 'download') {
                        const raw = url.searchParams.get('version');
                        const d = await store.templateDownload(u, tid, raw ? Number(raw) : undefined);
                        res.writeHead(200, { 'Content-Type': d.mime, 'Content-Disposition': 'attachment; filename="' + d.filename + '"' });
                        res.end(d.bytes);
                        return;
                    }
                }
                if (p === '/api/me' && m === 'GET')
                    return json(200, { user: u, csrf: session.csrf, developmentOnly: !options.production, passwordLogin: options.passwordLogin === true });
                if (p === '/api/logout' && m === 'POST') {
                    await store.logout(cookies[sessionName]);
                    res.setHeader('Set-Cookie', cookie(sessionName, '', 0));
                    return json(200, { ok: true });
                }
                if (p === '/api/colleagues' && m === 'GET')
                    return json(200, await store.colleagues(u, url.searchParams.get('department') || ''));
                if (p === '/api/clients' && m === 'GET') {
                    const clientIds = new Set((await store.list(u, '', url.searchParams.get('department') || '')).map((r: any) => r.clientId));
                    return json(200, (await store.all('SELECT id,name FROM clients WHERE org=?', u.org)).filter((c: any) => clientIds.has(c.id)));
                }
                if (p === '/api/agreements' && m === 'GET')
                    return json(200, await store.list(u, url.searchParams.get('q') || '', url.searchParams.get('department') || ''));
                if (p === '/api/agreements' && m === 'POST')
                    return json(201, await store.create(u, b));
                if (p === '/api/export' && m === 'GET') {
                    if (!['legal_manager', 'auditor'].includes(u.role)) {
                        await store.audit(u, 'export', 'agreements', 'deny');
                        fail(403, 'Export requires Legal Manager or scoped auditor');
                    }
                    const rows = await store.list(u, '', url.searchParams.get('department') || '');
                    await store.audit(u, 'export', 'agreements');
                    res.setHeader('Content-Disposition', 'attachment; filename="legal-doc-manager-export.json"');
                    return json(200, rows);
                }
                if (p === '/api/privacy' && m === 'GET')
                    return json(200, await store.privacy(u));
                if (p === '/api/privacy' && m === 'POST')
                    return json(201, await store.privacy(u, b));
                if (p === '/api/audit' && m === 'GET')
                    return json(200, await store.audits(u, url.searchParams.get('department') || ''));
                if(p==='/api/users/audit'&&m==='GET'){if(u.role!=='admin')fail(403,'Administrator only');return json(200,await store.all("SELECT id,actor,action,target,decision,at FROM audit WHERE org=? AND (action LIKE 'users:%' OR action IN ('password:changed','login','google:login')) ORDER BY id DESC LIMIT 200",u.org))}
                if(p==='/api/users'&&m==='GET')return json(200,await userDirectory(store,u));
                if(p==='/api/users'&&m==='POST')return json(201,await createUser(store,u,b,localPasswords));
                let match;
                if((match=p.match(/^\/api\/users\/([a-zA-Z0-9@._-]+)\/credentials$/))&&m==='POST')return json(200,await userCredentials(store,u,match[1],b,localPasswords));
                if((match=p.match(/^\/api\/users\/([a-zA-Z0-9@._-]+)$/))){if(m==='PATCH')return json(200,await editUser(store,u,match[1],b));if(m==='DELETE')return json(200,await removeUser(store,u,match[1],b));}
                if ((match = p.match(/^\/api\/privacy\/([a-f0-9]+)$/)) && m === 'PATCH')
                    return json(200, await store.reviewPrivacy(u, match[1], b));
                if ((match = p.match(/^\/api\/agreements\/([a-f0-9]+)$/)) && m === 'GET')
                    return json(200, await store.get(u, match[1]));
                if ((match = p.match(/^\/api\/agreements\/([a-f0-9]+)\/documents$/)) && m === 'POST')
                    return json(201, await store.upload(u, match[1], b));
                if ((match = p.match(/^\/api\/agreements\/([a-f0-9]+)\/actions\/([a-z]+)$/)) && m === 'POST')
                    return json(200, await store.transition(u, match[1], match[2], b));
                if ((match = p.match(/^\/api\/agreements\/([a-f0-9]+)\/deletion-proposals$/)) && m === 'POST')
                    return json(201, await store.deletion(u, match[1], b));
                if ((match = p.match(/^\/api\/documents\/([a-f0-9]+)$/)) && m === 'GET') {
                    const doc = await store.download(u, match[1]);
                    res.writeHead(200, { 'Content-Type': doc.mime, 'Content-Disposition': 'attachment; filename="' + doc.filename + '"' });
                    res.end(doc.bytes);
                    return;
                }
                fail(404, 'Route not found');
            }
            if (req.method === 'GET' && ['/', '/app.js', '/admin.js', '/style.css'].includes(url.pathname)) {
                const filename = url.pathname === '/' ? 'index.html' : url.pathname.slice(1);
                res.writeHead(200, { 'Content-Type': filename.endsWith('.js') ? 'text/javascript' : filename.endsWith('.css') ? 'text/css' : 'text/html' });
                res.end(readFileSync(new URL('../backend/public/' + filename, import.meta.url)));
                return;
            }
            fail(404, 'Page not found');
        }
        catch (e: any) {
            throw e;
        }
    }
    return http.createServer(async (req, res) => {
        const headers: any = {};
        let status = 200, body: any = '';
        let ended = false;
        const output = { setHeader: (k: string, v: any) => { headers[k] = v; }, writeHead: (n: number, h: any = {}) => { status = n; Object.assign(headers, h); }, end: (data: any = '') => { body = data; ended = true; } };
        try {
            const loginAttempt=req.url?.startsWith('/api/login')||req.url?.startsWith('/auth/google');
            await options.database.transaction(options.org,async(db:any)=>{
                const key=digest((loginAttempt?'login:':'request:')+(req.socket.remoteAddress||'unknown')+':'+Math.floor(Date.now()/60000));
                await db.query('DELETE FROM rate_limits WHERE expires<?',[Date.now()]);
                if(loginAttempt)await db.query('DELETE FROM sessions WHERE expires<? OR last_seen<?',[Date.now(),Date.now()-1800000]);
                const r=await db.query('INSERT INTO rate_limits(id,count,expires) VALUES(?,1,?) ON CONFLICT(id) DO UPDATE SET count=rate_limits.count+1 RETURNING count',[key,Date.now()+120000]);
                return Number(r.rows[0].count);
            }).then(count=>{if(count>(loginAttempt?10:300))throw new Fault(429,'Too many attempts. Try again shortly.')});
            await options.database.transaction(options.org, async (db: any) => { const store = createStore(db, options.objects, options.scanner); await handle(req, output, store); });
            if (!ended)
                throw new Error('No response');
        }
        catch (e: any) {
            status = e instanceof Fault ? e.status : 500;
            body = JSON.stringify({ error: status === 500 ? 'The request could not be completed. No database changes were saved.' : e.message });
            headers['Content-Type'] = 'application/json';
            headers['Cache-Control'] = 'no-store';
            delete headers['Content-Disposition'];
            delete headers['Set-Cookie'];
            if ([401, 403, 404, 409, 422].includes(status)) {
                try {
                    await options.database.transaction(options.org, async (db: any) => { await db.query('INSERT INTO audit(org,actor,action,target,decision,at) VALUES(?,?,?,?,?,?)', [options.org, (output as any).actor?.id||'anonymous', 'http:' + req.method, String(req.url || '').split('?')[0].slice(0, 200), 'deny:' + status, new Date().toISOString()]); });
                }
                catch { }
            }
            if (status === 500)
                console.error(JSON.stringify({ event: 'request_failed', code: e.code || 'internal', time: new Date().toISOString() }));
            if (req.url?.startsWith('/auth/google/callback')) {
                status = 302;
                headers.Location = '/?signin=failed';
                body = '';
            }
        }
        res.writeHead(status, headers);
        res.end(body);
    });
}
