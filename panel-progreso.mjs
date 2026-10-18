// Panel local para ver en porcentajes cómo va el proceso de fotos.
// Solo funciona en esta PC: abre http://localhost:4400 (no se publica en ningún lado).
//
// Uso: npm run panel

import fs from "node:fs";
import http from "node:http";
import os from "node:os";
import path from "node:path";

const RAIZ = path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1"));
const DESCARGAS = path.join(os.homedir(), "Downloads", "FOTOS - CARRERA 18-10");
const LOGS_WRANGLER = path.join(process.env.APPDATA ?? "", "xdg.config", ".wrangler", "logs");
const PUBLICADO = "https://fotos.pacelabpanama.com/fotos.json";
const PUERTO = 4400;

const contar = (dir, ext) => {
  try {
    return fs.readdirSync(dir).filter((f) => f.toLowerCase().endsWith(ext)).length;
  } catch {
    return 0;
  }
};

function fotosEnDescargas() {
  const nombres = new Set();
  const recorrer = (dir) => {
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
      if (e.isDirectory()) recorrer(path.join(dir, e.name));
      else if (e.name.toLowerCase().endsWith(".jpg")) nombres.add(e.name.toLowerCase());
    }
  };
  try {
    recorrer(DESCARGAS);
  } catch {}
  return nombres.size;
}

// Fecha de la foto web más reciente: si es posterior a la última subida, hay fotos pendientes
function fotoMasNueva() {
  const dir = path.join(RAIZ, "site", "fotos", "hd");
  let max = 0;
  try {
    for (const f of fs.readdirSync(dir)) max = Math.max(max, fs.statSync(path.join(dir, f)).mtimeMs);
  } catch {}
  return max;
}

function subidaCloudflare() {
  try {
    const logs = fs.readdirSync(LOGS_WRANGLER).filter((f) => f.endsWith(".log")).sort();
    // El último log de un deploy (wrangler también escribe logs de otros comandos)
    const ultimo = logs.reverse().find((f) => fs.readFileSync(path.join(LOGS_WRANGLER, f), "utf8").includes("assets"));
    if (!ultimo) return null;
    const ruta = path.join(LOGS_WRANGLER, ultimo);
    const texto = fs.readFileSync(ruta, "utf8");
    if (fs.statSync(ruta).birthtimeMs < fotoMasNueva()) return { hechas: 0, total: 1, terminado: false, nota: "pendiente" };
    const subidas = [...texto.matchAll(/Uploaded (\d+) of (\d+) assets?/g)].at(-1);
    const terminado = /Success! Uploaded|No updated asset files to upload|Current Version ID/.test(texto);
    if (subidas) return { hechas: +subidas[1], total: +subidas[2], terminado };
    return { hechas: terminado ? 1 : 0, total: 1, terminado };
  } catch {
    return null;
  }
}

let publicadas = { n: 0, hora: 0 };
async function fotosPublicadas() {
  if (Date.now() - publicadas.hora > 20000) {
    try {
      const j = await fetch(`${PUBLICADO}?t=${Date.now()}`).then((r) => r.json());
      publicadas = { n: j.fotos.length, hora: Date.now() };
    } catch {}
  }
  return publicadas.n;
}

async function estado() {
  const enDescargas = fotosEnDescargas();
  const originales = contar(path.join(RAIZ, "fotos-originales"), ".jpg");
  const web = contar(path.join(RAIZ, "site", "fotos", "hd"), ".jpg");
  let leidas = 0;
  try {
    leidas = Object.keys(JSON.parse(fs.readFileSync(path.join(RAIZ, "dorsales-auto.json"), "utf8"))).length;
  } catch {}
  let locales = 0;
  try {
    locales = JSON.parse(fs.readFileSync(path.join(RAIZ, "site", "fotos.json"), "utf8")).fotos.length;
  } catch {}
  const subida = subidaCloudflare();
  const enLinea = await fotosPublicadas();
  return {
    etapas: [
      { nombre: "Copiar fotos a la PC", hechas: originales, total: Math.max(enDescargas, originales) },
      { nombre: "Versiones web", hechas: web, total: originales },
      { nombre: "Lectura de dorsales", hechas: Math.min(leidas, web), total: web },
      { nombre: "Subida a Cloudflare", hechas: subida?.hechas ?? 0, total: subida?.total ?? 1, nota: subida?.nota ?? (subida?.terminado ? "terminada" : "subiendo") },
      { nombre: "Publicadas en la web", hechas: enLinea, total: Math.max(originales, enLinea) },
    ],
    hora: new Date().toLocaleTimeString("es-PA"),
    locales,
  };
}

const PAGINA = `<!doctype html><html lang="es"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1"><title>Progreso de fotos</title>
<style>
:root{--fondo:#1e1e1e;--tarjeta:#2a2725;--texto:#fff;--gris:#b4ada6;--amarillo:#fdc80f;--verde:#3ccf7a}
body{margin:0;background:var(--fondo);color:var(--texto);font:600 16px system-ui,sans-serif;padding:24px 16px}
main{max-width:640px;margin:auto}h1{font-size:28px;margin:0 0 4px}p{color:var(--gris);margin:0 0 24px;font-weight:500}
.etapa{background:var(--tarjeta);border-radius:12px;padding:16px;margin-bottom:12px}
.fila{display:flex;justify-content:space-between;align-items:baseline;margin-bottom:10px}
.pct{font-size:28px;font-weight:800;color:var(--amarillo)}.etapa.lista .pct{color:var(--verde)}
.barra{height:12px;background:#3a3633;border-radius:99px;overflow:hidden}
.barra i{display:block;height:100%;background:var(--amarillo);border-radius:99px;transition:width .6s}
.etapa.lista .barra i{background:var(--verde)}.cuenta{color:var(--gris);font-size:13px;margin-top:8px;font-weight:500}
</style></head><body><main><h1>Progreso de fotos</h1><p id="hora">Cargando…</p><div id="etapas"></div></main>
<script>
async function actualizar(){
  try{
    const e=await fetch("/estado").then(r=>r.json());
    document.getElementById("hora").textContent="Actualizado a las "+e.hora+" · se refresca solo";
    document.getElementById("etapas").innerHTML=e.etapas.map(s=>{
      const pct=s.total?Math.min(100,Math.floor(s.hechas/s.total*100)):0;
      return '<div class="etapa'+(pct>=100?' lista':'')+'"><div class="fila"><span>'+s.nombre+'</span><span class="pct">'+pct+'%</span></div>'+
      '<div class="barra"><i style="width:'+pct+'%"></i></div><div class="cuenta">'+s.hechas.toLocaleString("es")+' de '+s.total.toLocaleString("es")+(s.nota?' · '+s.nota:'')+'</div></div>';
    }).join("");
  }catch{document.getElementById("hora").textContent="Sin conexión con el panel";}
}
actualizar();setInterval(actualizar,3000);
</script></body></html>`;

http
  .createServer(async (req, res) => {
    if (req.url === "/estado") {
      res.writeHead(200, { "content-type": "application/json" });
      res.end(JSON.stringify(await estado()));
    } else {
      res.writeHead(200, { "content-type": "text/html; charset=utf-8" });
      res.end(PAGINA);
    }
  })
  // Solo escucha en esta PC
  .listen(PUERTO, "127.0.0.1", () => console.log(`Panel en http://localhost:${PUERTO}`));
