#!/usr/bin/env node
// stripe-webhook-check: find unsafe Stripe webhook handlers in a Next.js app.
// Zero dependencies, read-only. Usage: node check-webhook.mjs [repoDir] [--json] [--fail-on=critical|high|medium|none]
import { readFileSync, readdirSync, statSync, existsSync } from "node:fs";
import { join, relative, sep } from "node:path";
import { pathToFileURL } from "node:url";

const SKIP = new Set(["node_modules", ".next", ".git", "dist", "build", "out", ".vercel", "coverage", ".claude", ".cursor", ".agents"]);
export const CHECKS = {
  W1: { sev: "critical", title: "No signature verification", fix: "Verify with stripe.webhooks.constructEvent(rawBody, signature, process.env.STRIPE_WEBHOOK_SECRET)." },
  W2: { sev: "critical", title: "Body parsed as JSON before verification", fix: "Read the raw body with await request.text() and pass that to constructEvent." },
  W3: { sev: "high", title: "Idempotency missing or not status-aware", fix: "Record event.id (unique) with status 'pending', skip a duplicate only if it is 'completed' (otherwise process it again), set 'completed' after processing succeeds, and return 5xx on failure so Stripe retries." },
  W4: { sev: "medium", title: "Webhook runs on the Edge runtime", fix: "Use export const runtime = \"nodejs\" (or remove the edge export)." },
  W5: { sev: "medium", title: "Webhook secret hard-coded", fix: "Move whsec_… into STRIPE_WEBHOOK_SECRET and roll the secret in the Stripe dashboard." },
};
const SEV = ["critical", "high", "medium"];

function walk(dir, root, out = []) {
  for (const n of readdirSync(dir)) {
    if (SKIP.has(n)) continue;
    const p = join(dir, n); let st; try { st = statSync(p); } catch { continue; }
    if (st.isDirectory()) walk(p, root, out);
    else if (/route\.(ts|js|mjs)$/.test(n) || /^pages\/api\/.*\.(ts|js)$/.test(relative(root, p).split(sep).join("/"))) out.push(relative(root, p).split(sep).join("/"));
  }
  return out;
}
const lineOf = (t, i) => t.slice(0, i).split("\n").length;
const redact = (s) => s.replace(/\b(whsec_|sk_live_|sk_test_)[\w]{4,}/g, (m) => `${m.slice(0, 6)}…[redacted]`);

export function check(root) {
  const findings = [], handlers = [];
  for (const f of walk(root, root)) {
    const t = readFileSync(join(root, f), "utf8");
    if (!/stripe/i.test(t) || !(/webhook/i.test(f) || /constructEvent|stripe-signature|checkout\.session\.completed/i.test(t))) continue;
    handlers.push(f);
    const add = (id, i) => { const line = i < 0 ? 1 : lineOf(t, i); findings.push({ id, ...CHECKS[id], file: f, line, evidence: redact((t.split("\n")[line - 1] ?? "").trim()).slice(0, 160) }); };
    const v = t.search(/constructEvent(Async)?\(/), j = t.search(/(request|req)\.json\(\)|JSON\.parse\(/);
    if (v < 0) add("W1", -1);
    if (j >= 0 && (v < 0 || j < v)) add("W2", j);
    if (!/(stripe_events|processed_events|webhook_events|event\.id|idempot)/i.test(t)) add("W3", -1);
    else {
      // "seen before -> 200" or claim-then-delete with no pending/completed state loses an event whose first attempt failed or crashed
      const d = t.search(/["']23505["']|unique_violation|\.delete\(\)[^;]*event\.id/);
      if (d >= 0 && !/["'](completed|processed|done)["']|processed_at|completed_at/.test(t)) add("W3", d);
    }
    if (/runtime\s*=\s*["']edge["']/.test(t)) add("W4", t.search(/runtime\s*=/));
    if (/whsec_[\w]{8,}/.test(t)) add("W5", t.search(/whsec_/));
  }
  findings.sort((a, b) => SEV.indexOf(a.sev) - SEV.indexOf(b.sev) || a.id.localeCompare(b.id) || a.file.localeCompare(b.file));
  return { root, handlers, findings };
}

export function toMarkdown(r) {
  const out = [`# stripe-webhook-check`, ``, `Webhook handler(s): ${r.handlers.length ? r.handlers.map((h) => "`" + h + "`").join(", ") : "none found"}. ${r.findings.length} finding(s).`, ``];
  if (!r.handlers.length) out.push("No Stripe webhook route found (looked for route files mentioning Stripe under a webhook path, or using constructEvent).");
  else if (!r.findings.length) out.push("Signature verified on the raw body, status-aware event de-duplication, Node runtime. Looks right.");
  else {
    out.push("| Sev | Check | Location | Evidence | Fix |", "|---|---|---|---|---|");
    for (const f of r.findings) out.push(`| ${f.sev} | ${f.id} ${f.title} | \`${f.file}:${f.line}\` | \`${f.evidence.replace(/[|`]/g, "'")}\` | ${f.fix.replace(/\|/g, "\\|")} |`);
  }
  return out.join("\n");
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) {
  const a = process.argv.slice(2), dir = a.find((x) => !x.startsWith("--")) ?? process.cwd();
  if (!existsSync(dir)) { console.error(`No such directory: ${dir}`); process.exit(2); }
  const r = check(dir);
  console.log(a.includes("--json") ? JSON.stringify(r, null, 2) : toMarkdown(r));
  const fo = (a.find((x) => x.startsWith("--fail-on=")) ?? "--fail-on=none").split("=")[1];
  if (fo !== "none" && r.findings.some((f) => SEV.indexOf(f.sev) <= SEV.indexOf(fo))) process.exit(1);
}
