// @ts-check
// scripts/crew/lib/claims.mjs
import { readdirSync, readFileSync, writeFileSync, rmSync, mkdirSync, existsSync } from 'node:fs';
import { join } from 'node:path';

/**
 * @typedef {Object} Claim
 * @property {string} pbiId
 * @property {string[]} files
 * @property {string} worktree
 * @property {string} branch
 * @property {string} status
 * @property {string} heartbeat ISO timestamp
 * @property {string} owner
 */

/** @param {string} root @returns {string} */
const claimsDir = (root) => {
  const d = join(root, 'claims');
  if (!existsSync(d)) mkdirSync(d, { recursive: true });
  return d;
};

/** @param {string} root @param {string} pbiId @returns {string} */
const claimPath = (root, pbiId) => join(claimsDir(root), `${pbiId}.json`);

/**
 * @param {string} root
 * @returns {Claim[]}
 */
export function readClaims(root) {
  const d = claimsDir(root);
  return readdirSync(d)
    .filter((f) => f.endsWith('.json'))
    .map((f) => /** @type {Claim} */ (JSON.parse(readFileSync(join(d, f), 'utf8'))));
}

/**
 * Overwrite an existing claim (used for heartbeat/status updates).
 * @param {string} root @param {Claim} claim
 */
export function writeClaim(root, claim) {
  writeFileSync(claimPath(root, claim.pbiId), JSON.stringify(claim, null, 2));
}

/**
 * Atomic create: returns false if a claim already exists (the `wx` flag throws EEXIST).
 * @param {string} root @param {Claim} claim @returns {boolean}
 */
export function tryClaim(root, claim) {
  try {
    writeFileSync(claimPath(root, claim.pbiId), JSON.stringify(claim, null, 2), { flag: 'wx' });
    return true;
  } catch (err) {
    if (/** @type {NodeJS.ErrnoException} */ (err).code === 'EEXIST') return false;
    throw err;
  }
}

/**
 * @param {string} root @param {string} pbiId
 */
export function releaseClaim(root, pbiId) {
  rmSync(claimPath(root, pbiId), { force: true });
}
