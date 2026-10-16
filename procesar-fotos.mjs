// Procesa las fotos de fotos-originales/ y genera:
//   site/fotos/mini/<id>.webp   miniatura para la galería (640 px)
//   site/fotos/hd/<id>.jpg      versión para ver y descargar (2560 px)
//   site/fotos.json             índice que lee la página
//
// Cada subcarpeta de fotos-originales/ es una categoría ("01 Salida", "02 Lodo"...).
// El número inicial solo sirve para ordenar y no se muestra.
//
// Dorsales: opcionalmente crea dorsales.csv con líneas  archivo,dorsales
//   IMG_3195.jpg,038 039 112
// También se detectan en el nombre del archivo con el formato  _d038-039  (ej. IMG_3195_d038-039.jpg)
//
// Uso:  npm run fotos            (solo procesa fotos nuevas)
//       npm run fotos -- --todo  (vuelve a generar todo)

import fs from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";

const RAIZ = path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1"));
const ENTRADA = path.join(RAIZ, "fotos-originales");
const SALIDA = path.join(RAIZ, "site", "fotos");
const CSV = path.join(RAIZ, "dorsales.csv");
const TODO = process.argv.includes("--todo");
const EXT = new Set([".jpg", ".jpeg", ".png", ".webp", ".tif", ".tiff"]);
const PARALELO = 4;

const slug = (s) =>
  s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
const nombreCategoria = (carpeta) => carpeta.replace(/^\d+[\s._-]*/, "").trim() || carpeta;
const normalizaDorsal = (d) => String(parseInt(d, 10));

async function leerDorsalesCsv() {
  const mapa = new Map();
  try {
    const texto = await fs.readFile(CSV, "utf8");
    for (const linea of texto.split(/\r?\n/)) {
      const [archivo, resto] = linea.split(/,(.*)/s);
      if (!archivo || !resto || /^archivo$/i.test(archivo.trim())) continue;
      const nums = resto.match(/\d+/g) ?? [];
      mapa.set(archivo.trim().toLowerCase(), nums.map(normalizaDorsal));
    }
  } catch {}
  return mapa;
}

async function existeMasNuevo(destino, origenMtime) {
  try {
    return (await fs.stat(destino)).mtimeMs >= origenMtime;
  } catch {
    return false;
  }
}

async function main() {
  await fs.mkdir(path.join(SALIDA, "mini"), { recursive: true });
  await fs.mkdir(path.join(SALIDA, "hd"), { recursive: true });
  const dorsalesCsv = await leerDorsalesCsv();

  const entradas = await fs.readdir(ENTRADA, { withFileTypes: true });
  const carpetas = entradas.filter((e) => e.isDirectory()).map((e) => e.name).sort((a, b) => a.localeCompare(b, "es", { numeric: true }));
  const sueltas = entradas.some((e) => e.isFile() && EXT.has(path.extname(e.name).toLowerCase()));
  if (sueltas) carpetas.unshift(".");

  const trabajos = [];
  const categorias = [];
  for (const carpeta of carpetas) {
    const dir = path.join(ENTRADA, carpeta);
    const cat = carpeta === "." ? "General" : nombreCategoria(carpeta);
    const catId = slug(cat);
    const archivos = (await fs.readdir(dir)).filter((f) => EXT.has(path.extname(f).toLowerCase())).sort((a, b) => a.localeCompare(b, "es", { numeric: true }));
    if (!archivos.length) continue;
    categorias.push({ id: catId, nombre: cat, total: archivos.length });
    for (const archivo of archivos) trabajos.push({ archivo, dir, catId });
  }

  const fotos = new Array(trabajos.length);
  let hechas = 0, nuevas = 0;
  let siguiente = 0;
  async function trabajador() {
    while (siguiente < trabajos.length) {
      const i = siguiente++;
      const { archivo, dir, catId } = trabajos[i];
      const origen = path.join(dir, archivo);
      const base = path.parse(archivo).name;
      const id = `${catId}-${slug(base)}`;
      const mini = path.join(SALIDA, "mini", `${id}.webp`);
      const hd = path.join(SALIDA, "hd", `${id}.jpg`);
      const { mtimeMs } = await fs.stat(origen);

      if (TODO || !(await existeMasNuevo(hd, mtimeMs)) || !(await existeMasNuevo(mini, mtimeMs))) {
        const img = sharp(origen, { failOn: "none" }).rotate();
        await img.clone().resize({ width: 2560, height: 2560, fit: "inside", withoutEnlargement: true }).jpeg({ quality: 88, mozjpeg: true }).withMetadata({ orientation: undefined }).toFile(hd);
        await img.clone().resize({ width: 640, height: 960, fit: "inside", withoutEnlargement: true }).webp({ quality: 72 }).toFile(mini);
        nuevas++;
      }
      const { width, height } = await sharp(hd).metadata();

      const deNombre = (base.match(/_d([\d-]+)/i)?.[1] ?? "").split("-").filter(Boolean).map(normalizaDorsal);
      const deCsv = dorsalesCsv.get(archivo.toLowerCase()) ?? [];
      const d = [...new Set([...deNombre, ...deCsv])];

      fotos[i] = { id, c: catId, w: width, h: height, ...(d.length ? { d } : {}) };
      hechas++;
      if (hechas % 25 === 0 || hechas === trabajos.length) process.stdout.write(`\r  ${hechas}/${trabajos.length} fotos`);
    }
  }
  await Promise.all(Array.from({ length: PARALELO }, trabajador));

  const indice = { generado: new Date().toISOString(), categorias, fotos };
  await fs.writeFile(path.join(RAIZ, "site", "fotos.json"), JSON.stringify(indice));
  const conDorsal = fotos.filter((f) => f.d).length;
  console.log(`\nListo: ${fotos.length} fotos (${nuevas} procesadas ahora), ${categorias.length} categorías, ${conDorsal} con dorsal.`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
