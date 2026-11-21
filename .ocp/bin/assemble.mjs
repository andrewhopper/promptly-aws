// File UUID: 4e8b2c71-9d3a-4f05-a6e2-7c1b9d0f3a58
/**
 * ocp.steering/v1 assembler — the one place atoms become context (standards/steering.md).
 *
 * Pure and dependency-free (node >= 20) so the same file runs in the CLI (`ocp render`) and,
 * copied to .ocp/bin/assemble.mjs, inside the hook shim for just-in-time steering.
 *
 *   select  atoms whose scopes match the path (no path: every atom); same id → the most specific scope wins
 *   order   NEVER > MUST > SHOULD > PREFER, then id
 *   budget  drop from the lowest level up until the estimate fits; report what was dropped
 *   skip    definitions already loaded (id + scopes) are not loaded again; a more specific override of a
 *           loaded atom is still injected
 */

export const LEVEL_ORDER = { NEVER: 0, MUST: 1, SHOULD: 2, PREFER: 3 };

/** Glob → RegExp over '/'-separated relative paths: `**`, `*`, `?`, `{a,b}`. */
export function globToRegExp(glob) {
  let re = "";
  for (let i = 0; i < glob.length; i++) {
    const c = glob[i];
    if (c === "*") {
      if (glob[i + 1] === "*") {
        const slash = glob[i + 2] === "/";
        re += slash ? "(?:.*/)?" : ".*";
        i += slash ? 2 : 1;
      } else re += "[^/]*";
    } else if (c === "?") re += "[^/]";
    else if (c === "{") {
      const end = glob.indexOf("}", i);
      if (end === -1) re += "\\{";
      else {
        re += "(?:" + glob.slice(i + 1, end).split(",").map((p) => p.replace(/[.+^$()|[\]\\]/g, "\\$&").replace(/\*/g, "[^/]*")).join("|") + ")";
        i = end;
      }
    } else re += /[.+^$()|[\]\\]/.test(c) ? "\\" + c : c;
  }
  return new RegExp("^" + re + "$");
}

/** Does any of the atom's scopes match the relative path? A scope that is a bare folder ("src") covers everything under it. */
export function scopeMatches(scopes, relPath) {
  const path = relPath.replace(/^\.\//, "");
  return (scopes?.length ? scopes : ["**"]).some((s) => {
    const scope = s.replace(/^\.\//, "").replace(/\/$/, "");
    if (scope === "**" || scope === "") return true;
    if (!/[*?{]/.test(scope)) return path === scope || path.startsWith(scope + "/");
    return globToRegExp(scope).test(path);
  });
}

/** Rough token estimate: 4 characters per token, as claudify does. */
export function estimateTokens(text) {
  return Math.ceil(text.length / 4);
}

export function orderAtoms(atoms) {
  return [...atoms].sort((a, b) => (LEVEL_ORDER[a.level] ?? 9) - (LEVEL_ORDER[b.level] ?? 9) || a.id.localeCompare(b.id));
}

/** Identity of one definition of an atom: id plus its scopes, so a scoped override is not mistaken for the loaded global. */
export function atomKey(atom) {
  return `${atom.id}@${[...(atom.scopes?.length ? atom.scopes : ["**"])].sort().join("|")}`;
}

const isGlobal = (a) => !a.scopes?.length || a.scopes.every((s) => s === "**");

/** Higher = more specific: global < folder < glob depth. */
function specificity(atom) {
  return Math.max(0, ...(atom.scopes ?? ["**"]).map((s) => (s === "**" ? 0 : s.split("/").filter((p) => p && p !== "**").length + (/[*?{]/.test(s) ? 0 : 0.5))));
}

/**
 * @param {{atoms: Array<{id:string, level:string, scopes?:string[], rule:string}>, path?: string, only?: "global"|"scoped", budget?: number, loaded?: Iterable<string>}} opts  loaded holds atomKey() values
 * @returns {{included: object[], dropped: object[], skipped: string[], tokens: number}}
 */
export function assemble({ atoms, path, only, budget, loaded }) {
  const seen = new Set(loaded ?? []);
  let pool = atoms.filter((a) => (only === "global" ? isGlobal(a) : only === "scoped" ? !isGlobal(a) : true));
  if (path !== undefined) pool = pool.filter((a) => scopeMatches(a.scopes, path));
  // same id from several layers: keep the most specific scope
  const byId = new Map();
  for (const a of pool) {
    const prev = byId.get(a.id);
    if (!prev || specificity(a) >= specificity(prev)) byId.set(a.id, a);
  }
  const skipped = [];
  let chosen = [];
  for (const a of byId.values()) (seen.has(atomKey(a)) ? skipped.push(a.id) : chosen.push(a));
  chosen = orderAtoms(chosen);
  const dropped = [];
  if (budget && budget > 0) {
    const cost = (list) => estimateTokens(list.map((a) => a.rule).join("\n"));
    while (chosen.length > 1 && cost(chosen) > budget) dropped.unshift(chosen.pop());
  }
  return { included: chosen, dropped, skipped, tokens: estimateTokens(chosen.map((a) => a.rule).join("\n")) };
}

/** Markdown lines for a just-in-time injection. */
export function renderAtoms(atoms, heading) {
  if (!atoms.length) return "";
  return [heading, ...atoms.map((a) => `- **${a.level}** ${a.rule.trim()} <!-- ${a.id} -->`)].join("\n");
}
