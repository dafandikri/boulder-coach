// scripts/crew/lib/backlog.mjs
/**
 * @typedef {Object} Pbi
 * @property {string} id
 * @property {string} title
 * @property {string} priority
 * @property {string} complexity
 * @property {string[]} dependsOn
 * @property {string[]} files
 * @property {'open'|'in-progress'|'done'} status
 */

/** @returns {Pbi[]} */
export function parseBacklog(markdown) {
  const pbis = [];
  let cur = null;
  for (const raw of markdown.split('\n')) {
    const line = raw.trimEnd();
    const header = line.match(/^###\s+(BC-\d+)\s*·\s*(.+)$/);
    if (header) {
      if (cur) pbis.push(cur);
      const rest = header[2];
      const statusM = rest.match(/—\s*`?\s*(done|in-progress|open)/i);
      cur = {
        id: header[1],
        title: rest.split('—')[0].trim(),
        priority: '',
        complexity: '',
        dependsOn: [],
        files: [],
        status: statusM ? /** @type {any} */ (statusM[1].toLowerCase()) : 'open',
      };
      continue;
    }
    if (!cur) continue;
    const prio = line.match(/\*\*Priority:\*\*\s*(P\d)/);
    if (prio) cur.priority = prio[1];
    const cx = line.match(/\*\*Complexity:\*\*\s*(XL|S|M|L)/);
    if (cx) cur.complexity = cx[1];
    const dep = line.match(/\*\*Depends on:\*\*\s*([^·]+)/);
    if (dep) cur.dependsOn = dep[1].match(/BC-\d+/g) ?? [];
    const files = line.match(/\*\*Files:\*\*\s*(.+)$/);
    if (files) {
      cur.files = files[1]
        .split(',')
        .map((s) => s.replace(/`/g, '').trim())
        .filter((s) => /^[\w./*-]+$/.test(s) && s.includes('/'));
    }
  }
  if (cur) pbis.push(cur);
  return pbis;
}
