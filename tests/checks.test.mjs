import { test } from "node:test";
import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { mkdtempSync, mkdirSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { check as rls, CHECKS as RC } from "../skills/rls-check/check-rls.mjs";
import { check as hook, CHECKS as WC } from "../skills/stripe-webhook-check/check-webhook.mjs";

const fx = (n) => fileURLToPath(new URL(`./fixtures/${n}`, import.meta.url));
const ids = (r) => r.findings.map((f) => f.id).sort();
const RLS = fileURLToPath(new URL("../skills/rls-check/check-rls.mjs", import.meta.url));
const WH = fileURLToPath(new URL("../skills/stripe-webhook-check/check-webhook.mjs", import.meta.url));

test("rls-check: every check fires on the bad fixture", () => {
  const r = rls(fx("bad"));
  assert.deepEqual(ids(r), ["R1", "R2", "R3", "R4", "R5"]);
  assert.ok(Object.keys(RC).every((k) => ids(r).includes(k)));
  const r1 = r.findings.find((f) => f.id === "R1");
  assert.equal(r1.line, 1); assert.match(r1.evidence, /profiles/);
});
test("rls-check: zero findings on the good fixture (comments and non-public schemas ignored)", () => {
  assert.deepEqual(rls(fx("good")).findings, []);
});
test("stripe-webhook-check: every check fires on the bad fixture", () => {
  const r = hook(fx("bad"));
  assert.deepEqual(ids(r), ["W1", "W2", "W3", "W4", "W5"]);
  assert.ok(Object.keys(WC).every((k) => ids(r).includes(k)));
  assert.equal(r.findings.find((f) => f.id === "W2").line, 5);
});
test("stripe-webhook-check: zero findings on the good fixture", () => {
  const r = hook(fx("good"));
  assert.deepEqual(r.handlers, ["app/api/webhooks/stripe/route.ts"]);
  assert.deepEqual(r.findings, []);
});
test("stripe-webhook-check: W3 flags status-less dedupe and claim-then-delete", () => {
  const head = 'import Stripe from "stripe";\nexport const runtime = "nodejs";\nexport async function POST(request: Request) {\n  const body = await request.text();\n  const event = stripe.webhooks.constructEvent(body, sig, process.env.STRIPE_WEBHOOK_SECRET!);\n';
  for (const body of [
    '  const { error } = await db.from("stripe_events").insert({ id: event.id });\n  if (error?.code === "23505") return new Response("dup");\n}\n',
    '  await db.from("stripe_events").insert({ id: event.id });\n  try { await work(); } catch (e) { await db.from("stripe_events").delete().eq("id", event.id); throw e; }\n}\n',
  ]) {
    const d = mkdtempSync(join(tmpdir(), "ssc-w3-"));
    mkdirSync(join(d, "app/api/webhooks/stripe"), { recursive: true });
    writeFileSync(join(d, "app/api/webhooks/stripe/route.ts"), head + body);
    assert.deepEqual(hook(d).findings.map((f) => f.id), ["W3"]);
  }
});
test("secrets are redacted in all output", () => {
  const out = execFileSync("node", [WH, fx("bad"), "--json"], { encoding: "utf8" });
  assert.ok(!out.includes("whsec_FAKE_FOR_TESTS_NOT_A_REAL_SECRET"));
  assert.match(out, /\[redacted\]/);
});
test("empty repos give a helpful message, not an error", () => {
  assert.match(execFileSync("node", [RLS, fx("empty")], { encoding: "utf8" }), /supabase db pull/);
  assert.match(execFileSync("node", [WH, fx("empty")], { encoding: "utf8" }), /No Stripe webhook route found/);
});
test("--fail-on exit codes work for CI", () => {
  assert.equal(spawnSync("node", [RLS, fx("bad"), "--fail-on=critical"]).status, 1);
  assert.equal(spawnSync("node", [RLS, fx("good"), "--fail-on=high"]).status, 0);
  assert.equal(spawnSync("node", [WH, fx("bad"), "--fail-on=high"]).status, 1);
  assert.equal(spawnSync("node", [WH, fx("good")]).status, 0);
  assert.equal(spawnSync("node", [WH, "/no/such/dir"]).status, 2);
});
