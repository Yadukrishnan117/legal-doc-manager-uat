import { randomBytes, createHash, scryptSync, timingSafeEqual, createCipheriv, createDecipheriv } from 'node:crypto';
export const roles = ['legal_manager', 'legal_staff', 'sales', 'operations', 'reviewer', 'admin', 'auditor'];
export const departments = ['Station Management', 'Software', 'Hardware', 'Miscellaneous'];
export const types = { 'Station Management': ['CPP Agreement', 'CPP on Sale', 'CPP on Operations', 'Lease Agreement', 'Property Hosting Agreement'], Software: ['White-label app agreement'], Hardware: ['Custom hardware agreement'], Miscellaneous: ['Other legal request'] };
export type User = {
    id: string;
    org: string;
    name: string;
    role: string;
    departments: string[];
    team?: string;
    active?: number;
};
export class Fault extends Error {
    status: number;
    constructor(status: number, message: string) { super(message); this.status = status; }
}
export const fail = (status: number, message: string): never => { throw new Fault(status, message); };
export const digest = (s: any) => createHash('sha256').update(s).digest('hex');
export const now = () => new Date().toISOString();
export const id = () => randomBytes(16).toString('hex');
export function required(v: any, name: string, max = 1000) { if (typeof v !== 'string' || !v.trim() || v.length > max)
    fail(400, 'Invalid ' + name); return v.trim(); }
export function vault(key: Buffer) { return { seal(b: Buffer) { const iv = randomBytes(12), c = createCipheriv('aes-256-gcm', key, iv); const out = Buffer.concat([c.update(b), c.final()]); return Buffer.concat([iv, c.getAuthTag(), out]); }, open(b: any) { b = Buffer.from(b); const d = createDecipheriv('aes-256-gcm', key, b.subarray(0, 12)); d.setAuthTag(b.subarray(12, 28)); return Buffer.concat([d.update(b.subarray(28)), d.final()]); } }; }
export function createStore(db: any, objects: any, scanner: any) {
    const crypto = { seal: async (b: Buffer) => { await scanner.scan(b); return objects.put(b); }, open: async (ref: any) => objects.get(ref) };
    const sql = async (q: string, ...p: any[]) => db.query(q, p);
    const one = async (q: string, ...p: any[]) => (await db.query(q, p)).rows[0];
    const all = async (q: string, ...p: any[]) => (await db.query(q, p)).rows;
    async function audit(u: User, action: string, target: string, decision = 'allow') { await sql('INSERT INTO audit(org,actor,action,target,decision,at) VALUES(?,?,?,?,?,?)', u.org, u.id, action, target, decision, now()); }
    async function deny(u: User, action: string, target: string) { await audit(u, action, target, 'deny'); return fail(403, 'This action is not permitted for your assignment and role.'); }
    const dept = (u: User, r: any) => u.org === r.org && u.departments.includes(r.dept);
    function canRead(u: User, r: any) { return dept(u, r) && (u.role === 'legal_manager' || u.role === 'auditor' || u.role === 'legal_staff' && r.legal === u.id || u.role === 'sales' && (r.sales === u.id || r.requester === u.id) || u.role === 'operations' && (r.ops === u.id || r.requester === u.id) || u.role === 'reviewer' && r.requester === u.id); }
    function legal(u: User, r: any) { return dept(u, r) && (u.role === 'legal_manager' || u.role === 'legal_staff' && r.legal === u.id); }
    async function load(u: User, rid: string, action = 'read') { const r = await one('SELECT * FROM agreements WHERE id=? FOR UPDATE', rid); if (!r || r.org !== u.org) {
        await audit(u, action, rid, 'deny');
        fail(404, 'Agreement not found.');
    } if (!canRead(u, r))
        await deny(u, action, rid); return { ...r, data: JSON.parse(r.data) }; }
    function checkRevision(r:any,b:any){if(b.revision!==r.data.revision)fail(409,'This agreement changed. Refresh it before continuing.')}
    async function put(r: any) { r.data.revision=(r.data.revision||0)+1; await sql('UPDATE agreements SET data=? WHERE id=?', JSON.stringify(r.data), r.id); }
    async function history(r: any, u: User, text: string) { r.data.history.push({ actor: u.id, name: u.name, at: now(), text }); await audit(u, text, r.id); }
    async function enqueue(r: any, event: string) { await sql('INSERT INTO outbox VALUES(?,?,?,?,?,?,?)', id(), r.org, event, r.id, r.data.v, 'pending_adapter', now()); }
    // The HTTP transaction owns commit/rollback; nested workflow operations share it.
    async function tx(fn: any) { return await fn(); }
    async function view(u: User, r: any) { const d = { ...r.data }; const docs = (await all('SELECT id,version,kind,filename,mime,digest,created FROM documents WHERE agreement_id=? ORDER BY version DESC', r.id)).filter(v => legal(u, r) || u.role === 'auditor' ? true : u.role === 'sales' && r.sales === u.id ? v.kind === 'draft' && v.version === d.shared : u.role === 'operations' && r.ops === u.id ? v.kind === 'draft' && v.version === d.released : false); if (!legal(u, r) && u.role !== 'auditor')
        d.history = d.history.filter((h: any) => !h.text.startsWith('Draft uploaded')); return { id: r.id, dept: r.dept, requester: r.requester, sales: r.sales, ops: r.ops, legal: r.legal, ...d, documents: docs, permissions: { legal: legal(u, r), approve: legal(u, r) && u.role === 'legal_manager', sales: dept(u, r) && u.role === 'sales' && r.sales === u.id, ops: dept(u, r) && u.role === 'operations' && r.ops === u.id } }; }
    async function addUser(u: any, password: string) { if(!/^[a-zA-Z0-9@._-]{1,100}$/.test(u.id||''))fail(400,'Use a valid account ID'); if (!roles.includes(u.role) || !Array.isArray(u.departments) || !u.departments.length || u.departments.some((d: string) => !departments.includes(d)))
        fail(400, 'Invalid role/departments'); if (password.length < 14 || password.length > 200)
        fail(400, 'Use a unique password of 14–200 characters.'); const salt = randomBytes(16).toString('hex'); await sql('INSERT INTO users(id,org,name,role,departments,salt,hash,active,team) VALUES(?,?,?,?,?,?,?,1,?)', required(u.id, 'id', 100), required(u.org, 'organization', 100), required(u.name, 'name', 100), u.role, JSON.stringify(u.departments), salt, scryptSync(password, salt, 64).toString('hex'), ['Accounts', 'Software', 'R&D'].includes(u.team) && u.role === 'reviewer' ? u.team : ({ sales: 'Sales', operations: 'Operations', legal_manager: 'Legal', legal_staff: 'Legal', admin: 'Administration', auditor: 'Audit' } as any)[u.role] || 'Technical review'); }
    async function user(uid: string) { const u = await one('SELECT id,org,name,role,departments,active,team,deleted_at,password_enabled,must_change_password,password_expires,account_revision FROM users WHERE id=? FOR SHARE', uid); return u ? { ...u, departments: JSON.parse(u.departments),mustChangePassword:!!u.must_change_password,passwordExpires:u.password_expires?Number(u.password_expires):null } : null; }
    async function login(uid: string, password: string) { const u = await one('SELECT * FROM users WHERE id=?', uid); const salt = u?.salt || 'nonexistent-account-salt'; const hash = scryptSync(password, salt, 64); if (!u || !u.active || u.deleted_at || !u.password_enabled || u.password_expires&&Number(u.password_expires)<=Date.now() || !timingSafeEqual(Buffer.from(u.hash, 'hex'), hash)) {
        if (u)
            await audit(await user(uid), 'login', uid, 'deny');
        fail(401, 'Invalid account or password.');
    } const token = randomBytes(32).toString('base64url'), csrf = randomBytes(24).toString('base64url'); await sql('INSERT INTO sessions(token_hash,user_id,csrf,expires) VALUES(?,?,?,?)', digest(token), uid, csrf, Date.now() + 8 * 3600000); await audit(await user(uid), 'login', uid); return { token, csrf, user: await user(uid) }; }
    async function session(token: string) { const s = await one("SELECT * FROM sessions WHERE token_hash=? AND expires>? AND last_seen>extract(epoch from now())*1000-1800000", digest(token), Date.now()); if (!s)
        return null; await sql('UPDATE sessions SET last_seen=? WHERE token_hash=?',Date.now(),digest(token)); const u = await user(s.user_id); if(s.auth_method==='google'&&u){u.mustChangePassword=false;u.passwordExpires=null} return u?.active&&!u.deleted_at&&(!u.passwordExpires||u.passwordExpires>Date.now()) ? { user: u, csrf: s.csrf, authMethod:s.auth_method } : null; }
    async function list(u: User, q = '', department = '') {
        if (department && !u.departments.includes(department)) await deny(u, 'department:filter', department);
        const records = (await all('SELECT * FROM agreements WHERE org=?',u.org)).filter(r=>canRead(u,r)&&(!department||r.dept===department));
        const rows = await Promise.all(records.map(r=>view(u,{...r,data:JSON.parse(r.data)})));
        await audit(u,'search/list','agreements');
        return rows.filter(r=>[r.clientName,r.ticket,r.agreement,r.type].join(' ').toLowerCase().includes(q.toLowerCase()));
    }
    async function create(u: User, b: any) {
        if (!['legal_manager', 'legal_staff', 'sales', 'operations', 'reviewer'].includes(u.role))
            await deny(u, 'create', 'agreement');
        if (!departments.includes(b.dept) || !u.departments.includes(b.dept))
            await deny(u, 'create', 'department');
        if (!(types as any)[b.dept].includes(b.type))
            fail(400, 'Choose an agreement type for this department.');
        const owner = await user(required(b.legal, 'legal owner', 100)), sales = await user(required(b.sales, 'Sales assignment', 100)), ops = await user(required(b.ops, 'Operations assignment', 100));
        for (const [v, rs] of [[owner, ['legal_manager', 'legal_staff']], [sales, ['sales']], [ops, ['operations']]] as any) {
            if (!v || v.org !== u.org || !v.active || !rs.includes(v.role) || !v.departments.includes(b.dept))
                fail(400, 'Assignment must be an active authorized colleague in this organization and department.');
        }
        const clientId = required(b.clientId, 'master client ID', 60), existing = await one('SELECT * FROM clients WHERE org=? AND id=?', u.org, clientId);
        const clientName = existing?.name || required(b.clientName, 'client company', 200);
        const terms = { scope: required(b.scope, 'product scope'), basis: required(b.basis, 'revenue basis and parties'), currency: required(b.currency, 'currency', 3), unit: required(b.unit, 'unit', 100), frequency: required(b.frequency, 'frequency', 40) } as any;
        for (const n of ['share', 'amount', 'setup', 'maintenance']) {
            const x = Number(b[n]);
            if (!Number.isFinite(x) || x < 0 || n === 'share' && x > 100)
                fail(400, 'Invalid commercial amount');
            terms[n] = String(x);
        }
        if (!/^[A-Z]{3}$/.test(terms.currency))
            fail(400, 'Use a three-letter currency code');
        const due = required(b.due, 'due date', 10);
        if (!/^\d{4}-\d{2}-\d{2}$/.test(due) || !Number.isFinite(Date.parse(due)))
            fail(400, 'Invalid due date');
        const purpose = required(b.purpose, 'processing purpose', 500), basis = required(b.lawfulBasis, 'lawful-basis rationale', 500);
        return await tx(async () => { const seq = Number((await one("SELECT nextval('agreement_number') n")).n), rid = id(), year = new Date().getUTCFullYear(); const data = { clientId, clientName, contactName: typeof b.contactName === 'string' ? b.contactName.trim().slice(0, 100) : '', contactEmail: typeof b.contactEmail === 'string' ? b.contactEmail.trim().slice(0, 200) : '', sla: { targetDays: 4, completionDays: 7, calendar: 'calendar days', start: 'lead creation', status: 'Proposed default; company confirmation required' }, ticket: `LEG-${year}-${String(seq).padStart(6, '0')}`, agreement: `AGR-${year}-${String(seq - 165).padStart(6, '0')}`, departmentClientRef: ({ 'Station Management': 'STM', Software: 'SW', Hardware: 'HW', Miscellaneous: 'MSC' } as any)[b.dept] + '-' + clientId, type: b.type, team: ['sales', 'operations', 'reviewer'].includes(u.role) ? (u.team || ({ sales: 'Sales', operations: 'Operations' } as any)[u.role] || 'Technical review') : required(b.team, 'submitting team', 60), site: required(b.site, 'site/project', 300), details: required(b.details, 'brief', 3000), priority: ['Normal', 'High', 'Urgent'].includes(b.priority) ? b.priority : 'Normal', due, created: now(), stage: 'Draft', revision: 0, v: 0, shared: 0, sent: 0, confirmed: 0, approved: 0, released: 0, ack: false, printed: false, dispatched: false, received: false, hold: false, retentionUntil: null, privacy: { purpose, lawfulBasis: basis, policyStatus: 'Company review pending' }, terms, history: [], changes: [] }; const r = { id: rid, org: u.org, dept: b.dept, requester: u.id, sales: sales.id, ops: ops.id, legal: owner.id, data }; await history(r, u, 'Legal request created'); if (!existing)
            await sql('INSERT INTO clients VALUES(?,?,?) ON CONFLICT(org,id) DO NOTHING', clientId, u.org, clientName); await sql('INSERT INTO agreements VALUES(?,?,?,?,?,?,?,?)', rid, u.org, b.dept, u.id, sales.id, ops.id, owner.id, JSON.stringify(data)); return await view(u, r); });
    }
    async function get(u: User, rid: string) { const r = await load(u, rid); await audit(u, 'read', rid); return await view(u, r); }
    async function upload(u: User, rid: string, b: any) { const r = await load(u, rid, 'upload'); const kind = b.kind || 'draft'; if (kind === 'draft' && !legal(u, r) || kind === 'original' && !(dept(u, r) && u.role === 'operations' && r.ops === u.id && r.data.dispatched) || !['draft', 'original'].includes(kind))
        await deny(u, 'upload', rid); checkRevision(r,b); if (r.data.stage === 'Fully Executed/Closed' || kind === 'draft' && r.data.released)
        fail(409, 'Released/closed documents cannot be revised.'); const name = required(b.filename, 'filename', 100); if (!/^[\w .()-]+\.(pdf|txt)$/i.test(name))
        fail(400, 'Use a plain PDF or TXT filename.'); const bytes = Buffer.from(required(b.content, 'file content', 3 * 1024 * 1024), 'base64'); if (!bytes.length || bytes.length > 2 * 1024 * 1024)
        fail(413, 'Files must be between 1 byte and 2 MB.'); const pdf = bytes.subarray(0, 5).toString() === '%PDF-'; if (name.toLowerCase().endsWith('.pdf') && !pdf || name.toLowerCase().endsWith('.txt') && (pdf || bytes.includes(0)))
        fail(400, 'File content does not match its type.'); return await tx(async () => { const v = kind === 'draft' ? r.data.v + 1 : r.data.released, did = id(); await sql('INSERT INTO documents VALUES(?,?,?,?,?,?,?,?,?)', did, r.id, v, kind, name, pdf ? 'application/pdf' : 'text/plain', digest(bytes), await crypto.seal(bytes), now()); if (kind === 'draft') {
        r.data.v = v;
        r.data.confirmed = 0;
        r.data.approved = 0;
        r.data.stage = 'Draft';
    } await history(r, u, (kind === 'draft' ? 'Draft uploaded' : 'Signed scan uploaded') + ' · v' + v); await put(r); return await view(u, r); }); }
    async function download(u: User, did: string) { const d = await one('SELECT * FROM documents WHERE id=?', did); if (!d)
        fail(404, 'Document not found'); const r = await load(u, d.agreement_id, 'download'); const allowed = legal(u, r) || u.role === 'auditor' || u.role === 'sales' && r.sales === u.id && d.kind === 'draft' && d.version === r.data.shared || u.role === 'operations' && r.ops === u.id && d.kind === 'draft' && d.version === r.data.released; if (!allowed)
        await deny(u, 'download', did); await audit(u, 'download', did); return { ...d, bytes: await crypto.open(d.bytes) }; }
    async function transition(u: User, rid: string, a: string, b: any = {}) {
        const r = await load(u, rid, 'transition'); const d = r.data, L = legal(u, r), S = dept(u, r) && u.role === 'sales' && r.sales === u.id, O = dept(u, r) && u.role === 'operations' && r.ops === u.id;
        if (!({ share: L, approve: L && u.role === 'legal_manager', release: L, verify: L, send: S, changes: S, confirm: S, ack: O, print: O, dispatch: O, receive: O, hold: L && u.role === 'legal_manager', retention: L && u.role === 'legal_manager' } as any)[a])
            await deny(u, 'transition:' + a, rid);
        checkRevision(r,b);
        if (d.stage === 'Fully Executed/Closed' && !['hold', 'retention'].includes(a))
            fail(409, 'Agreement is closed.');
        try {
            return await tx(async () => {
                let note = '';
                switch (a) {
                    case 'share':
                        if (!d.v || d.released || d.shared === d.v)
                            fail(409, 'Upload a new draft before sharing.');
                        d.shared = d.v;
                        d.sent = 0;
                        d.confirmed = 0;
                        d.approved = 0;
                        d.stage = d.v > 1 ? 'Revised and Reshared' : 'Shared with Sales';
                        note = 'Explicitly shared v' + d.v + ' with assigned Sales';
                        await enqueue(r, 'agreement.updated');
                        break;
                    case 'send':
                        if (!d.shared || d.released || d.sent === d.shared)
                            fail(409, 'No new shared copy to send');
                        d.sent = d.shared;
                        d.stage = 'Sent to Client';
                        note = 'Sales recorded sending v' + d.sent;
                        break;
                    case 'changes':
                        if (!d.sent || d.sent !== d.shared || d.released)
                            fail(409, 'Send the shared version first');
                        d.changes.push({ version: d.shared, note: required(b.note, 'requested changes'), at: now(), actor: u.id });
                        d.confirmed = 0;
                        d.approved = 0;
                        d.stage = 'Changes Requested';
                        note = 'Client changes requested for v' + d.shared;
                        break;
                    case 'confirm':
                        if (!d.shared || d.sent !== d.shared || d.stage === 'Changes Requested' || d.shared !== d.v || d.released)
                            fail(409, 'Current version must be shared and sent; resolve changes first.');
                        d.evidence = { reference: required(b.evidence, 'confirmation evidence'), date: required(b.date, 'confirmation date', 30), version: d.shared, actor: u.id, at: now() };
                        d.confirmed = d.shared;
                        d.stage = 'Client Confirmed';
                        note = 'Client confirmed exact v' + d.shared;
                        await enqueue(r, 'client.confirmed');
                        break;
                    case 'approve':
                        if (d.confirmed !== d.v || !d.v || d.released)
                            fail(409, 'Current-version client confirmation required');
                        d.approval = { reference: required(b.evidence, 'internal approval reference'), actor: u.id, at: now(), version: d.v };
                        d.approved = d.v;
                        note = 'Internal approval v' + d.v;
                        break;
                    case 'release':
                        if (!d.v || d.confirmed !== d.v || d.approved !== d.v || d.released)
                            fail(409, 'Exact-version client confirmation and internal approval required');
                        d.released = d.v;
                        d.stage = 'Ready for Operations';
                        note = 'Final v' + d.v + ' released to Operations';
                        break;
                    case 'ack':
                        if (!d.released || d.ack)
                            fail(409, 'Released final required');
                        d.ack = true;
                        note = 'Final received for execution';
                        break;
                    case 'print':
                        if (!d.ack || d.printed)
                            fail(409, 'Acknowledge first');
                        d.printed = true;
                        d.stage = 'Printed';
                        note = 'Released final printed';
                        break;
                    case 'dispatch':
                        if (!d.printed || d.dispatched)
                            fail(409, 'Print first');
                        d.dispatch = { method: required(b.method, 'dispatch method', 100), tracking: required(b.tracking, 'tracking', 200), destination: required(b.destination, 'destination', 300), date: required(b.date, 'dispatch date', 30) };
                        d.dispatched = true;
                        d.stage = 'Dispatched';
                        note = 'Final dispatched';
                        break;
                    case 'receive':
                        if (!d.dispatched || d.received || !await one("SELECT id FROM documents WHERE agreement_id=? AND kind='original' AND version=?", r.id, d.released))
                            fail(409, 'Dispatch and authenticated signed-original scan required');
                        d.receipt = { date: required(b.date, 'receipt date', 30), custody: required(b.custody, 'custody location', 300) };
                        d.received = true;
                        d.stage = 'Signed Original Received';
                        note = 'Signed original at office; Legal verification pending';
                        break;
                    case 'verify':
                        if (!d.received || !d.dispatched || d.confirmed !== d.released || d.approved !== d.released || b.versionMatch !== true || b.signatures !== true || b.custodyVerified !== true)
                            fail(409, 'Receipt, version, signatures and custody must be verified');
                        d.verification = { note: required(b.note, 'verification note'), actor: u.id, at: now(), version: d.released };
                        await history(r, u, 'Legal Verification completed for v' + d.released);
                        d.stage = 'Fully Executed/Closed';
                        note = 'Fully Executed/Closed';
                        await enqueue(r, 'agreement.executed');
                        break;
                    case 'hold':
                        if (typeof b.hold !== 'boolean')
                            fail(400, 'Explicit hold flag required');
                        required(b.note, 'hold reason');
                        d.hold = b.hold;
                        note = b.hold ? 'Legal hold placed' : 'Legal hold released';
                        break;
                    case 'retention':
                        if (!/^\d{4}-\d{2}-\d{2}$/.test(b.until || ''))
                            fail(400, 'Retention date required');
                        required(b.note, 'retention rationale');
                        d.retentionUntil = b.until;
                        note = 'Contract retention reviewed';
                        break;
                }
                await history(r, u, note);
                await put(r);
                return await view(u, r);
            });
        }
        catch (e) {
            await audit(u, 'transition:' + a, rid, 'rejected');
            throw e;
        }
    }
    async function privacy(u: User, b?: any) { if (!b) {
        await audit(u, 'privacy:list', 'requests');
        return (await all('SELECT * FROM privacy_requests WHERE org=?', u.org)).filter(r => u.role === 'legal_manager' || r.requester === u.id);
    } const kind = required(b.kind, 'request type', 30); if (!['Access', 'Correction', 'Erasure', 'Grievance'].includes(kind))
        fail(400, 'Invalid request type'); const pid = id(); await sql('INSERT INTO privacy_requests VALUES(?,?,?,?,?,?,?,?)', pid, u.org, u.id, kind, required(b.details, 'request details', 2000), 'Submitted', 'Identity, authority and legal retention review required', now()); await audit(u, 'privacy:submit', pid); return { id: pid, status: 'Submitted' }; }
    async function reviewPrivacy(u: User, pid: string, b: any) { if (u.role !== 'legal_manager')
        await deny(u, 'privacy:review', pid); const p = await one('SELECT * FROM privacy_requests WHERE id=? AND org=?', pid, u.org); if (!p)
        fail(404, 'Request not found'); if (!['Under review', 'Resolved', 'Refused with reasons'].includes(b.status))
        fail(400, 'Invalid review status'); await sql('UPDATE privacy_requests SET status=?,review=? WHERE id=?', b.status, required(b.note, 'review rationale', 2000), pid); await audit(u, 'privacy:review', pid); return { status: b.status }; }
    async function deletion(u: User, rid: string, b: any) { const r = await load(u, rid, 'deletion'); if (u.role !== 'legal_manager')
        await deny(u, 'deletion', rid); if (r.data.hold || !r.data.retentionUntil || new Date(r.data.retentionUntil + 'T23:59:59Z') >= new Date() || r.data.stage !== 'Fully Executed/Closed')
        fail(409, 'Deletion blocked by hold, unreviewed/unexpired retention, or active agreement'); const pid = id(); await sql('INSERT INTO deletion_proposals VALUES(?,?,?,?,?,?)', pid, rid, u.id, 'Pending separate approval', required(b.reason, 'deletion rationale'), now()); await audit(u, 'deletion:proposed', rid); return { id: pid, status: 'Pending separate approval', message: 'No data deleted. A controlled purge and backup retention process must be approved before production.' }; }
    async function admin(u: User, target: string, b: any) { if (u.role !== 'admin')
        await deny(u, 'users:update', target); if (target === u.id)
        fail(409, 'Use an independent administrator for self-account changes'); const t = await user(target); if (!t || t.org !== u.org)
        fail(404, 'User not found'); if (Object.keys(b).some(k => k !== 'active') || typeof b.active !== 'boolean')
        fail(400, 'Only activation changes are supported. Role grants require the trusted local management command.'); await sql('UPDATE users SET active=? WHERE id=?', b.active ? 1 : 0, target); await sql('DELETE FROM sessions WHERE user_id=?', target); await audit(u, 'users:activation', target); return { id: target, active: b.active }; }
    async function colleagues(u: User, department = '') { if (department && !u.departments.includes(department))
        await deny(u, 'department:colleagues', department); return (await all('SELECT id,name,role,departments,team FROM users WHERE org=? AND active=1', u.org)).map(r => ({ ...r, departments: JSON.parse(r.departments) })).filter(r => r.departments.some((d: string) => u.departments.includes(d) && (!department || d === department))); }
    async function audits(u:User,department='') {
        if(department&&!u.departments.includes(department))await deny(u,'department:audit',department);
        if(!['legal_manager','auditor'].includes(u.role))await deny(u,'audit:list','audit');
        const visible=[];
        for(const a of await all('SELECT * FROM audit WHERE org=? ORDER BY id DESC LIMIT 200',u.org)) {
            const r=await one('SELECT * FROM agreements WHERE id=? FOR UPDATE',a.target)||await one('SELECT a.* FROM agreements a JOIN documents d ON a.id=d.agreement_id WHERE d.id=?',a.target);
            if(r?canRead(u,r)&&(!department||r.dept===department):!department&&a.actor===u.id)visible.push(a);
        }
        return visible;
    }
    const libraryLegal = (u: User) => ['legal_manager', 'legal_staff'].includes(u.role);
    async function templateLoad(u: User, tid: string, write = false) { const t = await one('SELECT * FROM templates WHERE id=? FOR UPDATE', tid); if (!t || t.org !== u.org)
        fail(404, 'Common draft not found'); if (!u.departments.includes(t.dept) || !['legal_manager', 'legal_staff', 'sales', 'auditor'].includes(u.role) || write && !libraryLegal(u))
        await deny(u, 'library:access', tid); if (!libraryLegal(u) && u.role !== 'auditor' && (!t.published_version || !t.active))
        await deny(u, 'library:unpublished', tid); return t; }
    async function templateView(u: User, t: any) { const legal = libraryLegal(u) || u.role === 'auditor', v = legal ? t.current_version : t.published_version, meta = await one('SELECT filename,mime,digest,created FROM template_versions WHERE template_id=? AND version=?', t.id, v); return { id: t.id, dept: t.dept, type: t.type, title: t.title, currentVersion: legal ? t.current_version : undefined, publishedVersion: t.published_version, publishedAt: t.published_at, active: !!t.active, status: !t.active ? 'Withdrawn' : !legal ? 'Available for Sales' : t.current_version === t.published_version && t.published_version ? 'Available for Sales' : t.published_version ? 'New version awaiting publication' : 'Not published', ...meta, canPublish: u.role === 'legal_manager', canEdit: libraryLegal(u), canStart: u.role === 'sales' && t.active && t.published_version > 0 && (await one('SELECT mime FROM template_versions WHERE template_id=? AND version=?', t.id, t.published_version))?.mime === 'text/plain' }; }
    async function templateList(u:User,department='') {
        if(!['legal_manager','legal_staff','sales','auditor'].includes(u.role))await deny(u,'library:list','templates');
        if(department&&!u.departments.includes(department))await deny(u,'library:filter',department);
        await audit(u,'library:list','templates');
        const rows=(await all('SELECT * FROM templates WHERE org=?',u.org)).filter(t=>u.departments.includes(t.dept)&&(!department||t.dept===department)&&(libraryLegal(u)||u.role==='auditor'||t.published_version&&t.active));
        return await Promise.all(rows.map(t=>templateView(u,t)));
    }
    async function templateCreate(u: User, b: any) { if (!libraryLegal(u) || !u.departments.includes(b.dept))
        await deny(u, 'library:create', 'templates'); if (!(types as any)[b.dept]?.includes(b.type))
        fail(400, 'Choose a valid agreement type'); const tid = id(); await sql('INSERT INTO templates(id,org,dept,type,title) VALUES(?,?,?,?,?)', tid, u.org, b.dept, b.type, required(b.title, 'common draft title', 150)); await audit(u, 'library:created', tid); return await templateView(u, await one('SELECT * FROM templates WHERE id=? FOR UPDATE', tid)); }
    async function templateUpload(u: User, tid: string, b: any) { const t = await templateLoad(u, tid, true), filename = required(b.filename, 'filename', 100); if (!/^[\w .()-]+\.(txt|pdf)$/i.test(filename))
        fail(400, 'Choose a PDF or TXT filename'); const bytes = Buffer.from(required(b.content, 'file content', 3 * 1024 * 1024), 'base64'), pdf = filename.toLowerCase().endsWith('.pdf'); if (!bytes.length || bytes.length > 2 * 1024 * 1024)
        fail(413, 'Files must be 1 byte to 2 MB'); if (pdf && bytes.subarray(0, 5).toString() !== '%PDF-' || !pdf && (bytes.includes(0) || bytes.subarray(0, 5).toString() === '%PDF-'))
        fail(400, 'File content does not match its type'); return await tx(async () => { const v = t.current_version + 1; await sql('INSERT INTO template_versions VALUES(?,?,?,?,?,?,?,?)', t.id, v, filename, pdf ? 'application/pdf' : 'text/plain', digest(bytes), await crypto.seal(bytes), now(), u.id); await sql('UPDATE templates SET current_version=? WHERE id=?', v, t.id); await audit(u, 'library:version-uploaded', tid); return await templateView(u, { ...t, current_version: v }); }); }
    async function templatePublish(u: User, tid: string, b: any = {}) { const t = await templateLoad(u, tid, true); if (u.role !== 'legal_manager')
        await deny(u, 'library:publish', tid); if(b.version!==t.current_version)fail(409,'The common draft changed. Refresh before publishing or withdrawing.'); if (!t.current_version)
        fail(409, 'Upload a common draft first'); if (b.withdraw === true) {
        await sql('UPDATE templates SET active=0 WHERE id=?', tid);
        await audit(u, 'library:withdrawn', tid);
        return await templateView(u, { ...t, active: 0 });
    } const publicationEvidence = required(b.evidence, 'publication approval reference', 500); await sql('INSERT OR IGNORE INTO template_publications VALUES(?,?,?,?,?)', tid, t.current_version, u.id, publicationEvidence, now()); await sql('UPDATE templates SET published_version=current_version,published_by=?,published_at=?,active=1 WHERE id=?', u.id, now(), tid); await audit(u, 'library:published-v' + t.current_version, tid); return await templateView(u, await one('SELECT * FROM templates WHERE id=? FOR UPDATE', tid)); }
    async function templateDownload(u: User, tid: string, version?: number) { const t = await templateLoad(u, tid), v = version || (libraryLegal(u) || u.role === 'auditor' ? t.current_version : t.published_version); if (!Number.isSafeInteger(v) || v < 1)
        fail(404, 'No published document available'); if (u.role === 'sales' && v !== t.published_version)
        await deny(u, 'library:old-version', tid); const d = await one('SELECT * FROM template_versions WHERE template_id=? AND version=?', tid, v); if (!d)
        fail(404, 'Common draft version not found'); await audit(u, 'library:download-v' + v, tid); return { ...d, bytes: await crypto.open(d.bytes) }; }
    async function fromTemplate(u: User, tid: string, b: any) { if (u.role !== 'sales')
        await deny(u, 'library:start', tid); const t = await templateLoad(u, tid); if(b.templateVersion!==t.published_version)fail(409,'A new common draft was published. Refresh the library before preparing this copy.'); if (b.leadClosed !== true)
        fail(409, 'Record the closed lead before preparing a client draft'); const leadRef = required(b.leadRef, 'closed lead reference', 150), evidence = required(b.closureEvidence, 'lead closure evidence', 500), leadCreatedAt = required(b.leadCreatedAt, 'original lead creation timestamp', 40); if (!Number.isFinite(Date.parse(leadCreatedAt)) || Date.parse(leadCreatedAt) > Date.now())
        fail(400, 'Use the original lead creation date, not a future date'); if (b.dept && b.dept !== t.dept || b.type && b.type !== t.type)
        fail(400, 'Common draft department/type cannot be changed'); const fingerprint = digest(JSON.stringify(['clientId', 'clientName', 'site', 'scope', 'share', 'basis', 'amount', 'currency', 'unit', 'setup', 'maintenance', 'frequency', 'legal', 'ops', 'leadCreatedAt'].map(k => [k, String(b[k] ?? '')]))); const existing = await one('SELECT agreement_id,request_hash FROM agreement_starts WHERE org=? AND lead_ref=? AND template_id=?', u.org, leadRef, t.id); if (existing) {
        if (existing.request_hash !== fingerprint)
            fail(409, 'This lead already has a draft from this common agreement. Open that agreement instead of creating a conflicting copy.');
        return await get(u, existing.agreement_id);
    } const source = await templateDownload(u, tid, t.published_version); if (source.mime !== 'text/plain')
        fail(409, 'This PDF is a reference download. Ask Legal for a client-specific copy; automatic PDF/Word assembly is not configured.'); const master = source.bytes.toString('utf8'); const allowed = ['client_name', 'site', 'scope', 'currency', 'amount', 'unit', 'revenue_share', 'basis', 'setup_fee', 'maintenance_fee', 'maintenance_frequency']; for (const match of master.matchAll(/\{\{\s*([^}]+?)\s*\}\}/g))
        if (!allowed.includes(match[1]))
            fail(409, 'Common draft has an unsupported placeholder. Ask Legal to update it.'); return await tx(async () => { const created = await create(u, { ...b, dept: t.dept, type: t.type, sales: u.id }); const r = await load(u, created.id), d = r.data; const values: any = { client_name: d.clientName, site: d.site, scope: d.terms.scope, currency: d.terms.currency, amount: d.terms.amount, unit: d.terms.unit, revenue_share: d.terms.share, basis: d.terms.basis, setup_fee: d.terms.setup, maintenance_fee: d.terms.maintenance, maintenance_frequency: d.terms.frequency }; const bytes = Buffer.from(master.replace(/\{\{\s*([^}]+?)\s*\}\}/g, (_: string, k: string) => values[k])); await sql('INSERT INTO documents VALUES(?,?,?,?,?,?,?,?,?)', id(), r.id, 1, 'draft', 'client-draft-v1.txt', 'text/plain', digest(bytes), await crypto.seal(bytes), now()); d.v = 1; d.shared = 1; d.stage = 'Shared with Sales'; d.created = new Date(leadCreatedAt).toISOString(); d.lead = { reference: leadRef, closureEvidence: evidence, closedRecordedAt: now(), source: 'Manual entry; CRM not connected' }; d.templateSource = { id: t.id, title: t.title, version: t.published_version, digest: source.digest, publishedBy: t.published_by, publishedAt: t.published_at }; await history(r, u, 'Client draft prepared from Legal-published common draft v' + t.published_version + '; assigned Sales may send this frozen copy'); await put(r); await sql('INSERT INTO agreement_starts VALUES(?,?,?,?,?)', u.org, leadRef, t.id, r.id, fingerprint); await enqueue(r, 'agreement.updated'); return await view(u, r); }); }
    return { templateList, templateCreate, templateUpload, templatePublish, templateDownload, fromTemplate, db, sql, one, all, audit, addUser, user, login, session, logout: async (token: string) => await sql('DELETE FROM sessions WHERE token_hash=?', digest(token)), list, create, get, upload, download, transition, privacy, reviewPrivacy, deletion, admin, colleagues, audits };
}
