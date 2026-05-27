/* eslint-disable */
// One-shot: re-evaluates users who were auto-banned by the Hackatime ownership
// check with `expected=none`. Under the old logic (pre-fix), a 404 from
// `get_user_by_email` made `idsMatch=false` and triggered a ban — even when
// the user's Beest email was a secondary email on their Hackatime account.
//
// This script:
//   1. Pulls every user with a `hackatime_ownership_failed` audit log whose
//      label contains `expected=none`.
//   2. Decrypts their email, checks their current Airtable `Perms`.
//   3. Re-runs the new ownership logic against Hackatime admin APIs.
//   4. If they'd pass now and are still `Banned`, clears their `Perms` field
//      and writes a `ban_reverted` audit log.
//
// Defaults to dry-run. Pass `--apply` to actually mutate Airtable + audit_logs.
// Run from the repo root so backend/.env loads. Requires:
//   - DATABASE_URL
//   - DB_ENCRYPTION_KEY
//   - HACKATIME_BASE_URL (defaults to https://hackatime.hackclub.com)
//   - HACKATIME_ADMIN_API_KEY
//   - AIRTABLE_API_KEY
//   - AIRTABLE_BASE_ID
//   - AIRTABLE_TABLE_NAME

const path = require('path');
const crypto = require('crypto');
const backendDir = path.join(__dirname, '..', 'backend');
require(path.join(backendDir, 'node_modules', 'dotenv')).config({
  path: path.join(backendDir, '.env'),
});
const { Client } = require(path.join(backendDir, 'node_modules', 'pg'));

const APPLY = process.argv.includes('--apply');

function decryptField(encoded, keyHex) {
  const parts = encoded.split('.');
  if (parts.length !== 3) throw new Error('Malformed encrypted value');
  const key = Buffer.from(keyHex, 'hex');
  const iv = Buffer.from(parts[0], 'base64');
  const tag = Buffer.from(parts[1], 'base64');
  const ct = Buffer.from(parts[2], 'base64');
  const d = crypto.createDecipheriv('aes-256-gcm', key, iv);
  d.setAuthTag(tag);
  return d.update(ct).toString('utf8') + d.final('utf8');
}

const DSN = process.env.DATABASE_URL;
const ENC_KEY = process.env.DB_ENCRYPTION_KEY;
const HACKATIME_BASE = (process.env.HACKATIME_BASE_URL || 'https://hackatime.hackclub.com').replace(/\/+$/, '');
const HACKATIME_KEY = process.env.HACKATIME_ADMIN_API_KEY;
const AT_KEY = process.env.AIRTABLE_API_KEY;
const AT_BASE = process.env.AIRTABLE_BASE_ID;
const AT_TABLE = process.env.AIRTABLE_TABLE_NAME;

if (!DSN) throw new Error('DATABASE_URL not set');
if (!ENC_KEY) throw new Error('DB_ENCRYPTION_KEY not set');
if (!HACKATIME_KEY) throw new Error('HACKATIME_ADMIN_API_KEY not set');
if (!AT_KEY || !AT_BASE || !AT_TABLE) throw new Error('Airtable env vars not set');

const AT_URL = `https://api.airtable.com/v0/${AT_BASE}/${encodeURIComponent(AT_TABLE)}`;

function escAt(v) {
  return v.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
}

async function getAirtablePerms(email) {
  const params = new URLSearchParams({
    filterByFormula: `{Email} = "${escAt(email)}"`,
    maxRecords: '1',
  });
  params.append('fields[]', 'Perms');
  const res = await fetch(`${AT_URL}?${params}`, {
    headers: { Authorization: `Bearer ${AT_KEY}` },
  });
  if (!res.ok) throw new Error(`Airtable getPerms ${res.status}: ${await res.text()}`);
  const data = await res.json();
  const rec = data.records?.[0];
  return {
    recordId: rec?.id ?? null,
    perms: rec?.fields?.Perms ?? null,
  };
}

async function clearAirtablePerms(recordId) {
  const res = await fetch(`${AT_URL}/${recordId}`, {
    method: 'PATCH',
    headers: {
      Authorization: `Bearer ${AT_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ fields: { Perms: '' } }),
  });
  if (!res.ok) throw new Error(`Airtable clearPerms ${res.status}: ${await res.text()}`);
}

async function getUserByEmail(email) {
  const res = await fetch(`${HACKATIME_BASE}/api/admin/v1/user/get_user_by_email`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${HACKATIME_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ email }),
  });
  if (res.status === 404) return { status: 404, userId: null };
  if (!res.ok) return { status: res.status, userId: null };
  const body = await res.json().catch(() => null);
  const raw = body?.user_id ?? body?.data?.user_id ?? null;
  return { status: 200, userId: raw !== null && raw !== undefined ? String(raw) : null };
}

async function getUserInfo(userId) {
  const res = await fetch(
    `${HACKATIME_BASE}/api/admin/v1/user/info?user_id=${encodeURIComponent(userId)}`,
    { headers: { Authorization: `Bearer ${HACKATIME_KEY}` } },
  );
  if (!res.ok) return { ok: false };
  const body = await res.json().catch(() => null);
  const u = body?.user ?? body?.data ?? body ?? {};
  const trustLevel = u?.trust_level ?? u?.trust_factor?.trust_level ?? null;
  const banned = u?.banned === true;
  const rawEmails = u?.email_addresses ?? u?.emails ?? [];
  const emails = Array.isArray(rawEmails)
    ? rawEmails.filter((e) => typeof e === 'string').map((e) => e.toLowerCase())
    : [];
  return { ok: true, trustLevel, banned, emails };
}

// Mirrors the post-fix logic in hackatime.service.ts:verifyAccountOwnership.
// Returns { verdict: 'pass' | 'ban' | 'inconclusive', reason }.
function evaluate({ ownEmail, storedId, emailOwnerId, info }) {
  const linkedEmails = info?.emails ?? [];
  const linkedBanned = info?.banned ?? false;
  const linkedTrustLevel = info?.trustLevel ?? null;

  const lookupContradicts = emailOwnerId !== null && emailOwnerId !== storedId;
  const linkedEmailsContradict =
    linkedEmails.length > 0 && !linkedEmails.includes(ownEmail);
  const trustBad = linkedTrustLevel === 'red' || linkedBanned;

  if (lookupContradicts) {
    return { verdict: 'ban', reason: `lookup contradicts: stored=${storedId}, byEmail=${emailOwnerId}` };
  }
  if (linkedEmailsContradict) {
    return { verdict: 'ban', reason: `linked account emails (${linkedEmails.join(',')}) don't include ${ownEmail}` };
  }
  if (trustBad) {
    return { verdict: 'ban', reason: `linked banned (trust=${linkedTrustLevel}, banned=${linkedBanned})` };
  }

  const idsMatchByLookup = emailOwnerId !== null && emailOwnerId === storedId;
  const idsMatchByLinkedEmails = linkedEmails.includes(ownEmail);
  if (idsMatchByLookup || idsMatchByLinkedEmails) {
    return {
      verdict: 'pass',
      reason: idsMatchByLookup ? 'by-email lookup confirms stored id' : 'linked account lists user email',
    };
  }

  return { verdict: 'inconclusive', reason: 'no positive proof; no contradictions' };
}

(async () => {
  console.log(APPLY ? '*** APPLY MODE — will mutate Airtable + audit_logs ***' : 'DRY RUN (pass --apply to mutate)');

  const c = new Client({ connectionString: DSN });
  await c.connect();
  console.log(`Connected to ${DSN.replace(/:[^:@]+@/, ':***@')}`);

  // Pull candidate users: latest hackatime_ownership_failed event labeled `expected=none`.
  // The "expected=none" signature is the old-logic false-positive case.
  const { rows } = await c.query(`
    SELECT DISTINCT ON (u.id)
      u.id, u.email, u.hca_sub, u.slack_id, u.name, u.nickname, u.hackatime_user_id,
      a.label, a.created_at
    FROM users u
    JOIN audit_logs a ON a.user_id = u.id
    WHERE a.action = 'hackatime_ownership_failed'
      AND a.label LIKE '%expected=none%'
    ORDER BY u.id, a.created_at DESC
  `);
  console.log(`Found ${rows.length} candidate user(s) with expected=none ownership-fail event`);

  const results = { reverted: [], stillBanned: [], notBannedAnymore: [], decryptFail: [], skipped: [] };

  for (const r of rows) {
    const ident = `${r.name || '<no name>'} (slack=${r.slack_id || 'none'}, id=${r.id})`;
    let plainEmail;
    try {
      plainEmail = decryptField(r.email, ENC_KEY);
    } catch (err) {
      console.log(`  [${ident}] decrypt fail: ${err.message}`);
      results.decryptFail.push({ id: r.id });
      continue;
    }
    const ownEmail = plainEmail.toLowerCase();

    let airtable;
    try {
      airtable = await getAirtablePerms(plainEmail);
    } catch (err) {
      console.log(`  [${ident}] Airtable lookup failed: ${err.message}`);
      results.skipped.push({ id: r.id, name: r.name, slack: r.slack_id, reason: 'airtable lookup failed' });
      continue;
    }

    if (airtable.perms !== 'Banned') {
      console.log(`  [${ident}] currently perms=${airtable.perms ?? '<none>'} — skipping`);
      results.notBannedAnymore.push({ id: r.id, name: r.name, slack: r.slack_id, perms: airtable.perms });
      continue;
    }

    if (!r.hackatime_user_id) {
      console.log(`  [${ident}] no stored hackatime_user_id — cannot re-evaluate`);
      results.skipped.push({ id: r.id, name: r.name, slack: r.slack_id, reason: 'no stored hackatime_user_id' });
      continue;
    }
    const storedId = String(r.hackatime_user_id);

    const byEmail = await getUserByEmail(plainEmail);
    const info = await getUserInfo(storedId);

    if (!info.ok) {
      console.log(`  [${ident}] info(${storedId}) failed — skipping`);
      results.skipped.push({ id: r.id, name: r.name, slack: r.slack_id, reason: 'info call failed' });
      continue;
    }

    const { verdict, reason } = evaluate({
      ownEmail,
      storedId,
      emailOwnerId: byEmail.userId,
      info,
    });

    console.log(`  [${ident}] verdict=${verdict} (${reason})`);
    if (verdict !== 'pass') {
      results.stillBanned.push({ id: r.id, name: r.name, slack: r.slack_id, verdict, reason });
      continue;
    }

    if (!airtable.recordId) {
      console.log(`    no Airtable recordId — skipping mutation`);
      results.skipped.push({ id: r.id, name: r.name, slack: r.slack_id, reason: 'no airtable record id' });
      continue;
    }

    if (APPLY) {
      try {
        await clearAirtablePerms(airtable.recordId);
        await c.query(
          `INSERT INTO audit_logs (user_id, action, label) VALUES ($1, $2, $3)`,
          [r.id, 'ban_reverted', `Auto-revert of hackatime_ownership_failed false-positive: ${reason}`],
        );
        console.log(`    reverted`);
      } catch (err) {
        console.log(`    revert FAILED: ${err.message}`);
        results.skipped.push({ id: r.id, name: r.name, slack: r.slack_id, reason: `mutation failed: ${err.message}` });
        continue;
      }
    } else {
      console.log(`    would revert (dry run)`);
    }
    results.reverted.push({ id: r.id, name: r.name, slack: r.slack_id, reason });
  }

  await c.end();

  console.log('\n=== summary ===');
  console.log(`  ${APPLY ? 'reverted' : 'would revert'}: ${results.reverted.length}`);
  console.log(`  not banned anymore: ${results.notBannedAnymore.length}`);
  console.log(`  still bannable under new logic: ${results.stillBanned.length}`);
  console.log(`  skipped: ${results.skipped.length}`);
  console.log(`  decrypt failures: ${results.decryptFail.length}`);

  if (results.reverted.length) {
    console.log(`\n${APPLY ? 'reverted' : 'would revert'}:`);
    for (const r of results.reverted) console.log(`  - ${r.name} (slack=${r.slack}, id=${r.id}) — ${r.reason}`);
  }
  if (results.stillBanned.length) {
    console.log('\nstill bannable under new logic:');
    for (const r of results.stillBanned) console.log(`  - ${r.name} (slack=${r.slack}) — ${r.verdict}: ${r.reason}`);
  }
})();
