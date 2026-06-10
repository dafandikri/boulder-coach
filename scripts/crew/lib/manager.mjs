// scripts/crew/lib/manager.mjs
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

/**
 * @typedef {Object} SubTask
 * @property {string} id
 * @property {string[]} files
 */
/**
 * @typedef {Object} SplitPlan
 * @property {SubTask[]} split
 */

/**
 * Only large items need the LLM; S/M go straight through deterministically.
 * @param {{complexity: string}} pbi
 * @returns {boolean}
 */
export function shouldConsultBrain(pbi) {
  return pbi.complexity === 'L' || pbi.complexity === 'XL';
}

/**
 * Ask the manager brain whether to split a large PBI into file-disjoint sub-tasks.
 * Falls back to no-split on any error, so correctness never depends on the LLM.
 * @param {{id: string, complexity: string, files: string[]}} pbi
 * @returns {SplitPlan}
 */
export function consultBrain(pbi) {
  if (!shouldConsultBrain(pbi)) return { split: [] };
  try {
    const prompt = readFileSync(join(process.cwd(), 'scripts/crew/prompts/manager.md'), 'utf8')
      .replace(/{{PBI_ID}}/g, pbi.id)
      .replace(/{{COMPLEXITY}}/g, pbi.complexity)
      .replace(/{{FILES}}/g, pbi.files.join(', '));
    const out = execFileSync('claude', ['--print', prompt], { encoding: 'utf8' });
    const json = out.slice(out.indexOf('{'), out.lastIndexOf('}') + 1);
    const parsed = /** @type {SplitPlan} */ (JSON.parse(json));
    return Array.isArray(parsed.split) ? parsed : { split: [] };
  } catch {
    return { split: [] }; // fail safe: keep PBI whole, deterministic path still works
  }
}
