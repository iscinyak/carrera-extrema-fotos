// Procesa las fotos de fotos-originales/ y genera:
//   site/fotos/mini/<id>.webp   miniatura para la galería (640 px)
//   site/fotos/hd/<id>.jpg      versión para ver y descargar (2560 px)
//   site/fotos.json             índice que lee la página
//
// Cada subcarpeta de fotos-originales/ es una categoría ("01 Salida", "02 Lodo"...).
// El número inicial solo sirve para ordenar y no se muestra.
//
// Dorsales: se leen solos de cada foto con OCR (detectar-dorsales.py, resultado en dorsales-auto.json).
// También se toman del nombre del archivo con el formato  _d038-039  (ej. IMG_3195_d038-039.jpg).
// Para corregir una foto, anótala en dorsales.csv (archivo,dorsales). Lo que diga el CSV
// reemplaza a la lectura automática; con la columna vacía se le quitan los dorsales:
//   IMG_3195.jpg,038 039 112
//   IMG_3548.jpg,
//
// Uso:  npm run fotos            (solo procesa fotos nuevas)
//       npm run fotos -- --todo  (vuelve a generar todo)

import fs from "node:fs/promises";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import sharp from "sharp";

const RAIZ = path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1"));
const ENTRADA = path.join(RAIZ, "fotos-originales");
const SALIDA = path.join(RAIZ, "site", "fotos");
const CSV = path.join(RAIZ, "dorsales.csv");
const CACHE_OCR = path.join(RAIZ, "dorsales-auto.json");
const SIN_OCR = process.argv.includes("--sin-ocr");
const TODO = process.argv.includes("--todo");
const EXT = new Set([".jpg", ".jpeg", ".png", ".webp", ".tif", ".tiff"]);
const PARALELO = 4;
const DORSAL_MAX = 300; // esta carrera tiene dorsales del 001 al 300
const fueraDeRango = [];

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
      if (!archivo?.trim() || resto === undefined || /^archivo$/i.test(archivo.trim())) continue;
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

      fotos[i] = { id, c: catId, w: width, h: height, archivo, base };
      hechas++;
      if (hechas % 25 === 0 || hechas === trabajos.length) process.stdout.write(`\r  ${hechas}/${trabajos.length} fotos`);
    }
  }
  await Promise.all(Array.from({ length: PARALELO }, trabajador));

  const ocr = SIN_OCR ? {} : leerDorsalesConOcr(fotos.map((f) => f.id));
  let automaticas = 0, corregidas = 0;
  for (const f of fotos) {
    const deNombre = (f.base.match(/_d([\d-]+)/i)?.[1] ?? "").split("-").filter(Boolean).map(normalizaDorsal);
    const deCsv = dorsalesCsv.get(f.archivo.toLowerCase());
    const deOcr = ocr[f.id]?.d ?? [];
    if (deCsv) corregidas++;
    else if (deOcr.length) automaticas++;
    const todos = [...new Set([...deNombre, ...(deCsv ?? deOcr)])];
    const d = todos.filter((n) => n >= 1 && n <= DORSAL_MAX);
    for (const n of todos) if (!d.includes(n)) fueraDeRango.push(`${f.archivo}: ${n}`);
    delete f.archivo;
    delete f.base;
    if (d.length) f.d = d;
  }

  const indice = { generado: new Date().toISOString(), categorias, fotos };
  await fs.writeFile(path.join(RAIZ, "site", "fotos.json"), JSON.stringify(indice));
  const conDorsal = fotos.filter((f) => f.d).length;
  console.log(`\nListo: ${fotos.length} fotos (${nuevas} procesadas ahora), ${conDorsal} con dorsal.`);
  console.log(`  Dorsales leídos automáticamente en ${automaticas} fotos; ${corregidas} corregidas a mano en dorsales.csv.`);
  if (fueraDeRango.length) {
    console.log(`\nOjo: se ignoraron ${fueraDeRango.length} dorsales fuera del 001-${DORSAL_MAX} (¿error al escribirlos?):`);
    for (const linea of fueraDeRango) console.log(`  ${linea}`);
  }
}

// Lee los dorsales con detectar-dorsales.py (Python con RapidOCR en .venv)
function leerDorsalesConOcr(ids) {
  const python = [path.join(RAIZ, ".venv", "Scripts", "python.exe"), path.join(RAIZ, ".venv", "bin", "python")].find(existsSync);
  if (!python) {
    console.log("\n  Aviso: no está instalado el lector de dorsales (.venv). Mira LEEME.md. Sigo sin lectura automática.");
    return {};
  }
  console.log("");
  const r = spawnSync(python, ["-I", path.join(RAIZ, "detectar-dorsales.py"), path.join(SALIDA, "hd"), CACHE_OCR, String(DORSAL_MAX)], {
    input: JSON.stringify(ids),
    stdio: ["pipe", "inherit", "inherit"],
  });
  if (r.status !== 0) console.log("  Aviso: falló la lectura automática de dorsales; sigo con lo que haya.");
  try {
    return JSON.parse(readFileSync(CACHE_OCR, "utf8"));
  } catch {
    return {};
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
