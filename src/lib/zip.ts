/**
 * Dependency-free project export.
 *
 * The WebContainer VFS lives only in the browser's memory — there was no way to
 * get files OUT. This builds a valid .zip client-side (STORE method, no native
 * compression deps) from the VFS and triggers a download.
 *
 * STORE (method 0) keeps the format simple and dependency-free; source files
 * compress poorly anyway. CRC32 + local headers + central directory + EOCD.
 */
import { readTree, readFile } from './webcontainer';

// ---- CRC32 (standard zlib polynomial, reflected) ----
const CRC_TABLE: Uint32Array = (() => {
  const t = new Uint32Array(256);
  for (let i = 0; i < 256; i++) {
    let c = i;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[i] = c >>> 0;
  }
  return t;
})();

function crc32(data: Uint8Array): number {
  let c = 0xffffffff;
  for (let i = 0; i < data.length; i++) c = CRC_TABLE[(c ^ data[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

const u16 = (n: number): number[] => [n & 0xff, (n >>> 8) & 0xff];
const u32 = (n: number): number[] => [n & 0xff, (n >>> 8) & 0xff, (n >>> 16) & 0xff, (n >>> 24) & 0xff];

export type ZipEntry = { path: string; data: Uint8Array };

/** Build a STORE-method .zip from path→data entries (folders = trailing '/'). */
export function createZip(entries: ZipEntry[]): Uint8Array {
  const local: number[] = [];
  const central: number[] = [];
  const enc = new TextEncoder();
  let offset = 0;

  for (const e of entries) {
    const name = enc.encode(e.path);
    const crc = crc32(e.data);
    const size = e.data.length;

    local.push(
      ...u32(0x04034b50), ...u16(20), ...u16(0), ...u16(0), ...u16(0), ...u16(0),
      ...u32(crc), ...u32(size), ...u32(size), ...u16(name.length), ...u16(0),
    );
    for (const b of name) local.push(b);
    for (const b of e.data) local.push(b);

    central.push(
      ...u32(0x02014b50), ...u16(20), ...u16(20), ...u16(0), ...u16(0), ...u16(0), ...u16(0),
      ...u32(crc), ...u32(size), ...u32(size), ...u16(name.length), ...u16(0), ...u16(0),
      ...u16(0), ...u16(0), ...u32(0), ...u32(offset),
    );
    for (const b of name) central.push(b);

    offset += 30 + name.length + size;
  }

  const cdStart = offset;
  const eocd = [
    ...u32(0x06054b50), ...u16(0), ...u16(0),
    ...u16(entries.length), ...u16(entries.length),
    ...u32(central.length), ...u32(cdStart), ...u16(0),
  ];

  return new Uint8Array(local.concat(central, eocd));
}

/** Trigger a browser download for raw bytes. */
export function downloadBlob(filename: string, data: Uint8Array, type = 'application/zip'): void {
  // Copy into a fresh ArrayBuffer — TS 5.7's stricter Blob typings reject a
  // Uint8Array<ArrayBufferLike> directly (SharedArrayBuffer concern). The copy
  // is always a real ArrayBuffer, which is a valid BlobPart.
  const buf = new ArrayBuffer(data.byteLength);
  new Uint8Array(buf).set(data);
  const blob = new Blob([buf], { type });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}

/**
 * Read every file in the WebContainer VFS and download it as a single .zip.
 * Returns the number of files included. node_modules/.git are excluded by readTree.
 */
export async function exportProjectAsZip(name = 'project'): Promise<number> {
  const tree = await readTree('.');
  const enc = new TextEncoder();
  const entries: ZipEntry[] = [];
  for (const [path, isDir] of Object.entries(tree)) {
    if (isDir) {
      entries.push({ path: path + '/', data: new Uint8Array(0) }); // folder entry
    } else {
      let content = '';
      try {
        content = await readFile(path);
      } catch {
        continue; // skip unreadable (binary) files
      }
      entries.push({ path, data: enc.encode(content) });
    }
  }
  if (entries.length === 0) throw new Error('No files to export — the project is empty.');
  downloadBlob(`${name}.zip`, createZip(entries));
  return entries.length;
}
