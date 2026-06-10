// scripts/crew/lib/lease.mjs
/**
 * Has a claim's lease expired (no heartbeat within the window)?
 * @param {{heartbeat:string}} claim ISO heartbeat timestamp
 * @param {number} nowMs current time in ms
 * @param {number} leaseSeconds lease window in seconds
 * @returns {boolean}
 */
export function isExpired(claim, nowMs, leaseSeconds) {
  return nowMs - new Date(claim.heartbeat).getTime() > leaseSeconds * 1000;
}
