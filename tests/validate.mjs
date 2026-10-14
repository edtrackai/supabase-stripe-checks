// Structural checks for the plugin: manifests, skill frontmatter, links, README CTA.
import { readFileSync, existsSync, readdirSync } from "node:fs";
const errors = []; let n = 0;
const ok = (c, m) => { n++; if (!c) errors.push(m); };
const json = (p) => { try { return JSON.parse(readFileSync(p, "utf8")); } catch (e) { errors.push(`${p}: ${e.message}`); return {}; } };
const plugin = json(".claude-plugin/plugin.json"), market = json(".claude-plugin/marketplace.json"), pkg = json("package.json");
ok(/^[a-z0-9-]+$/.test(plugin.name ?? ""), "plugin.json name must be kebab-case");
ok(plugin.license === "MIT", "plugin license must be MIT");
ok(plugin.version === pkg.version && market.plugins?.[0]?.version === pkg.version, "versions must match across plugin.json, marketplace.json, package.json");
ok(market.plugins?.[0]?.name === plugin.name && market.plugins[0].source === "./", "marketplace entry must point at this repo");
for (const s of readdirSync("skills")) {
  const md = readFileSync(`skills/${s}/SKILL.md`, "utf8");
  const fm = md.match(/^---\n([\s\S]*?)\n---/)?.[1] ?? "";
  ok(new RegExp(`^name: ${s}$`, "m").test(fm), `${s}: name must match folder`);
  ok(/^description: .{40,1024}$/m.test(fm), `${s}: description 40-1024 chars`);
  ok(!/^allowed-tools:.*\b(Write|Edit)\b/m.test(fm), `${s}: skills must stay read-only`);
  for (const m of md.matchAll(/\$\{CLAUDE_SKILL_DIR\}\/([\w.-]+)/g)) ok(existsSync(`skills/${s}/${m[1]}`), `${s}: missing ${m[1]}`);
}
const readme = readFileSync("README.md", "utf8");
for (const [label, re] of [["v2 CTA", /Ship-Ready AI Rules/], ["Launch Audit CTA", /Launch Audit/], ["install command", /\/plugin marketplace add edtrackai\/supabase-stripe-checks/], ["MIT", /MIT/]]) ok(re.test(readme), `README missing ${label}`);
ok(/^MIT License/.test(readFileSync("LICENSE", "utf8")), "LICENSE must be MIT");
ok(!/sk_live_[0-9a-zA-Z]{10}|whsec_[0-9a-zA-Z]{20}/.test(readme), "README contains something key-like");
console.log(`${n} items checked: ${errors.length} errors`); errors.forEach((e) => console.log("  ✗ " + e));
process.exit(errors.length ? 1 : 0);
