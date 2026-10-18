// Publica la página en GitHub Pages (rama gh-pages) SIN las fotos.
// Las fotos se suben aparte a Cloudflare con `npm run deploy`, porque no caben en el
// límite de 1 GB de GitHub Pages. Aquí solo van el HTML, los estilos, los assets y fotos.json.
//
// Uso: npm run publicar

import { execFileSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const RAIZ = path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1"));
const SITE = path.join(RAIZ, "site");
const remoto = execFileSync("git", ["remote", "get-url", "origin"], { cwd: RAIZ }).toString().trim();
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "gh-pages-"));

fs.cpSync(SITE, tmp, {
  recursive: true,
  filter: (origen) => !path.relative(SITE, origen).split(path.sep).includes("fotos") || origen.endsWith("fotos.json"),
});

const git = (...args) => execFileSync("git", args, { cwd: tmp, stdio: "inherit" });
git("init", "-q", "-b", "gh-pages");
git("add", "-A");
git("commit", "-q", "-m", "Publicar página");
git("push", "-q", "--force", remoto, "gh-pages");
console.log(`Página publicada en GitHub Pages (${fs.readdirSync(tmp).length - 1} archivos y carpetas, sin fotos).`);
