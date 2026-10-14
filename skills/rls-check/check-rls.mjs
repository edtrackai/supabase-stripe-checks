#!/usr/bin/env node
// rls-check: find Supabase row-level security gaps in SQL migrations.
// Zero dependencies, read-only. Usage: node check-rls.mjs [repoDir] [--json] [--fail-on=critical|high|none]
import { readFileSync, readdirSync, statSync, existsSync } from "node:fs";
import { join, relative, sep } from "node:path";
import { pathToFileURL } from "node:url";

const SKIP = new Set(["node_modules", ".next", ".git", "dist", "build", "out", ".vercel", "coverage", ".claude", ".cursor", ".agents"]);
export const CHECKS = {
  R1: { sev: "critical", title: "Table created without enabling RLS", fix: "alter table public.<name> enable row level security;" },
  R2: { sev: "critical", title: "Blanket policy: using (true) / with check (true)", fix: "Scope it, e.g. using ((select auth.uid()) = user_id). Keep (true) only for public read-only data and say so in a comment." },
  R3: { sev: "high", title: "Write policy granted to anon/public", fix: "Use `to authenticated` and an ownership check." },
  R4: { sev: "high", title: "Insert/update policy without with check", fix: "Add with check ((select auth.uid()) = user_id) so users can't write rows they don't own." },
  R5: { sev: "high", title: "security definer function without a fixed search_path", fix: "Add: set search_path = ''" },
};
const SEV = ["critical", "high"];

function walk(dir, root, out = []) {
  for (const n of readdirSync(dir)) {
    if (SKIP.has(n)) continue;
    const p = join(dir, n); let st; try { st = statSync(p); } catch { continue; }
    if (st.isDirectory()) walk(p, root, out);
    else if (n.endsWith(".sql")) out.push(relative(root, p).split(sep).join("/"));
  }
  return out;
}
const lineOf = (t, i) => t.slice(0, i).split("\n").length;

export function check(root) {
  const files = walk(root, root).filter((f) => !/(^|\/)supabase\/tests\//.test(f));
  const src = Object.fromEntries(files.map((f) => [f, readFileSync(join(root, f), "utf8").replace(/--[^\n]*/g, (c) => " ".repeat(c.length))]));
  const all = Object.values(src).join("\n");
  const findings = [];
  const add = (id, file, line, raw) => findings.push({ id, ...CHECKS[id], file, line, evidence: (raw.split("\n")[line - 1] ?? "").trim().slice(0, 160) });
  for (const [f, sql] of Object.entries(src)) {
    const raw = readFileSync(join(root, f), "utf8");
    for (const m of sql.matchAll(/create\s+table\s+(if\s+not\s+exists\s+)?((public\.)?"?(\w+)"?)\s*\(/gi)) {
      if (m[2].includes(".") && !m[2].toLowerCase().startsWith("public.")) continue;
      if (!new RegExp(`alter\\s+table\\s+(if\\s+exists\\s+)?(only\\s+)?(public\\.)?"?${m[4]}"?\\s+enable\\s+row\\s+level\\s+security`, "i").test(all)) add("R1", f, lineOf(sql, m.index), raw);
    }
    for (const m of sql.matchAll(/create\s+policy[\s\S]*?;/gi)) {
      const p = m[0], ln = lineOf(sql, m.index);
      if (/(using|with\s+check)\s*\(\s*true\s*\)/i.test(p)) add("R2", f, ln, raw);
      if (/\bto\s+(anon|public)\b/i.test(p) && /for\s+(insert|update|delete|all)/i.test(p)) add("R3", f, ln, raw);
      if (/for\s+(insert|update)/i.test(p) && !/with\s+check/i.test(p)) add("R4", f, ln, raw);
    }
    for (const m of sql.matchAll(/create\s+(or\s+replace\s+)?function[\s\S]*?(\$\$|\$\w+\$)/gi))
      if (/security\s+definer/i.test(m[0]) && !/set\s+search_path/i.test(m[0])) add("R5", f, lineOf(sql, m.index), raw);
  }
  findings.sort((a, b) => SEV.indexOf(a.sev) - SEV.indexOf(b.sev) || a.id.localeCompare(b.id) || a.file.localeCompare(b.file) || a.line - b.line);
  return { root, sqlFiles: files.length, findings };
}

export function toMarkdown(r) {
  const out = [`# rls-check`, ``, `Scanned ${r.sqlFiles} SQL file(s). ${r.findings.length} finding(s).`, ``];
  if (!r.sqlFiles) out.push("No .sql files found. If your schema lives only in the Supabase dashboard, run `supabase db pull` first.");
  else if (!r.findings.length) out.push("No RLS gaps found by the automated checks. Still verify policies match your access rules.");
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
