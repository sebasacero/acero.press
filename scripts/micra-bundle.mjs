// Empaqueta la web de la app Micra (dist-micra/) para que la app instalada se
// actualice sola, sin reinstalar: un .zip y un latest.json en dist/micra-app/,
// que el sitio publica en https://www.aceropress.com/micra-app/. Corre después
// de los dos builds (sitio y Micra); `npm run build` lo hace en Vercel.
import { readdirSync, readFileSync, statSync, mkdirSync, writeFileSync } from 'node:fs';
import { join, relative } from 'node:path';
import { createHash } from 'node:crypto';
import { nativeKey } from './micra-native-key.mjs';

const root = new URL('..', import.meta.url).pathname;
const src = join(root, 'dist-micra');
const out = join(root, 'dist', 'micra-app');

const walk = (dir) => readdirSync(dir).flatMap((f) => {
  const p = join(dir, f);
  return statSync(p).isDirectory() ? walk(p) : [p];
});

// CRC-32 (el que pide el formato zip)
const TABLE = new Uint32Array(256).map((_, n) => {
  let c = n;
  for (let k = 0; k < 8; k += 1) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});
const crc32 = (buf) => {
  let c = 0xffffffff;
  for (const b of buf) c = TABLE[(c ^ b) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
};

/** Un zip sin comprimir (método 0): basta para unos cientos de kB y no necesita dependencias. */
function zip(files) {
  const locals = [];
  const centrals = [];
  let offset = 0;
  for (const { name, data } of files) {
    const n = Buffer.from(name, 'utf8');
    const crc = crc32(data);
    const local = Buffer.alloc(30 + n.length);
    local.writeUInt32LE(0x04034b50, 0); local.writeUInt16LE(20, 4); local.writeUInt16LE(0x0800, 6);
    local.writeUInt16LE(0, 8); local.writeUInt32LE(0, 10); local.writeUInt32LE(crc, 14);
    local.writeUInt32LE(data.length, 18); local.writeUInt32LE(data.length, 22);
    local.writeUInt16LE(n.length, 26); local.writeUInt16LE(0, 28); n.copy(local, 30);
    const central = Buffer.alloc(46 + n.length);
    central.writeUInt32LE(0x02014b50, 0); central.writeUInt16LE(20, 4); central.writeUInt16LE(20, 6);
    central.writeUInt16LE(0x0800, 8); central.writeUInt16LE(0, 10); central.writeUInt32LE(0, 12);
    central.writeUInt32LE(crc, 16); central.writeUInt32LE(data.length, 20); central.writeUInt32LE(data.length, 24);
    central.writeUInt16LE(n.length, 28); central.writeUInt32LE(offset, 42); n.copy(central, 46);
    locals.push(local, data);
    centrals.push(central);
    offset += local.length + data.length;
  }
  const cd = Buffer.concat(centrals);
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0); end.writeUInt16LE(files.length, 8); end.writeUInt16LE(files.length, 10);
  end.writeUInt32LE(cd.length, 12); end.writeUInt32LE(offset, 16);
  return Buffer.concat([...locals, cd, end]);
}

const files = walk(src).sort().map((p) => ({ name: relative(src, p).split('\\').join('/'), data: readFileSync(p) }));
if (!files.some((f) => f.name === 'index.html')) throw new Error('dist-micra/ no tiene index.html: corre antes el build de Micra');
// La versión es el contenido: si nada cambió, la app no descarga nada
const version = createHash('sha256').update(Buffer.concat(files.map((f) => Buffer.concat([Buffer.from(f.name), f.data])))).digest('hex').slice(0, 12);
mkdirSync(out, { recursive: true });
const zipName = `micra-${version}.zip`;
writeFileSync(join(out, zipName), zip(files));
writeFileSync(join(out, 'latest.json'), JSON.stringify({ version, native: nativeKey(), url: `https://www.aceropress.com/micra-app/${zipName}`, at: new Date().toISOString() }, null, 2));
console.log(`micra-app: ${version} (${files.length} archivos) → dist/micra-app/${zipName}`);
