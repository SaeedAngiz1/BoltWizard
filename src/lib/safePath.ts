/**
 * Path hardening for model-supplied file paths.
 *
 * The agent's <boltAction type="file" path="..."> paths come straight from an
 * LLM and are written into the WebContainer VFS. Before we trust one, we
 * canonicalise it and confine it to the project root: no absolute paths, no
 * Windows drive letters / UNC, no `..` escapes, no shell-dangerous characters.
 *
 * Returns a clean relative POSIX path (e.g. "src/components/Button.tsx"), or
 * `null` if the path is empty or tries to escape the sandbox.
 *
 * (WebContainer is already a sandbox, so this is defence-in-depth — it keeps
 * the file tree predictable and prevents a confused model from scattering files
 * into unexpected places.)
 */

const RESERVED_CHARS = /[<>:"|?*\x00-\x1f]/;
const WIN_RESERVED_NAMES =
  /^(con|prn|aux|nul|com[1-9]|lpt[1-9])(\.|$)/i;

export function safePath(raw: string): string | null {
  if (!raw || typeof raw !== 'string') return null;

  let p = raw.trim();
  if (!p) return null;

  // Normalise backslashes → forward slashes, drop any Windows drive letter.
  p = p.replace(/\\/g, '/');
  p = p.replace(/^[a-zA-Z]:/, '');
  // Strip a leading slash so the result is relative to the project root.
  p = p.replace(/^\/+/, '');

  const segments: string[] = [];
  for (const segRaw of p.split('/')) {
    const seg = segRaw.trim();
    if (seg === '' || seg === '.') continue;       // skip empty / same-dir
    if (seg === '..') {
      // Allowed only while it stays under the root: pop the last segment,
      // reject if it would climb above the project root.
      if (segments.length === 0) return null;
      segments.pop();
      continue;
    }
    if (RESERVED_CHARS.test(seg)) return null;      // shell/fs-dangerous chars
    if (WIN_RESERVED_NAMES.test(seg)) return null;  // CON, PRN, NUL, COM1…
    segments.push(seg);
  }

  const out = segments.join('/');
  return out || null;
}
