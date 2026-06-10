// scripts/crew/lib/glob.mjs
/** Convert a restricted glob (supports * and **) to an anchored RegExp. */
export function globToRegExp(glob) {
  const escaped = glob.replace(/[.+^${}()|[\]\\]/g, '\\$&');
  const body = escaped
    .replace(/\*\*\/?/g, '__GLOBSTAR__') // ** (optionally trailing slash) → placeholder
    .replace(/\*/g, '[^/]*') // * → within one segment
    .replace(/__GLOBSTAR__/g, '.*'); // placeholder → across segments
  return new RegExp(`^${body}$`);
}
