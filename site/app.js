const POR_TANDA = 48;
const $ = (s) => document.querySelector(s);
const mini = (f) => `fotos/mini/${f.id}.webp`;
const hd = (f) => `fotos/hd/${f.id}.jpg`;
const nombreDescarga = (f) => `carrera-extrema-${f.id}.jpg`;
const normaliza = (v) => (v.match(/\d+/) ? String(parseInt(v.match(/\d+/)[0], 10)) : "");
// Esta carrera tiene 300 dorsales, del 001 al 300
const DORSAL_MAX = 300;
const tresCifras = (d) => String(d).padStart(3, "0");
const dorsalValido = (d) => Number(d) >= 1 && Number(d) <= DORSAL_MAX;

const estado = { datos: null, lista: [], mostradas: 0, dorsal: "", actual: -1 };

const rejilla = $("#rejilla");
const visor = $("#visor");
const visorImg = $("#visorImg");

async function iniciar() {
  try {
    // La consulta única evita que Cloudflare entregue un listado viejo después de publicar
    estado.datos = await fetch(`fotos.json?t=${Date.now()}`, { cache: "no-store" }).then((r) => r.json());
  } catch {
    estado.datos = { categorias: [], fotos: [] };
  }
  const params = new URLSearchParams(location.hash.slice(1));
  if (params.get("dorsal")) $("#dorsal").value = params.get("dorsal");
  estado.dorsal = normaliza(params.get("dorsal") ?? "");
  aplicar(false);
  const foto = params.get("foto");
  if (foto) {
    const i = estado.lista.findIndex((f) => f.id === foto);
    if (i >= 0) abrir(i);
  }
}

function aplicar(desplazar = true) {
  const { fotos } = estado.datos;
  estado.lista = estado.dorsal ? fotos.filter((f) => f.d?.includes(estado.dorsal)) : fotos;
  estado.mostradas = 0;
  rejilla.replaceChildren();
  pintarFiltro();
  pintarCabecera();
  pintarTanda();
  actualizarUrl();
  if (desplazar) $("#galeria").scrollIntoView({ behavior: "smooth" });
}

// Muestra el chip "Dorsal 38 ✕" para volver a todas las fotos
function pintarFiltro() {
  const contenedor = $("#categorias");
  contenedor.hidden = !estado.dorsal;
  if (!estado.dorsal) return contenedor.replaceChildren();
  const b = document.createElement("button");
  b.type = "button";
  b.className = "chip chip-dorsal";
  b.textContent = `Dorsal ${tresCifras(estado.dorsal)} ✕`;
  b.setAttribute("aria-label", `Quitar filtro del dorsal ${tresCifras(estado.dorsal)}`);
  b.addEventListener("click", () => {
    estado.dorsal = "";
    $("#dorsal").value = "";
    aplicar();
  });
  contenedor.replaceChildren(b);
}

function pintarCabecera() {
  const n = estado.lista.length;
  const titulo = $("#tituloGaleria");
  const aviso = $("#aviso");
  const zip = $("#descargarTodas");
  titulo.innerHTML = estado.dorsal ? `Dorsal <span>${tresCifras(estado.dorsal)}</span>` : "Todas las fotos";
  $("#contador").textContent = n === 1 ? "1 foto" : `${n.toLocaleString("es")} fotos`;
  zip.hidden = !(estado.dorsal && n > 0);

  if (!estado.datos.fotos.length) {
    aviso.hidden = false;
    aviso.innerHTML = "<strong>¡Las fotos vienen en camino!</strong> Las estamos subiendo después de la carrera. Vuelve en unas horas.";
  } else if (estado.dorsal && !dorsalValido(estado.dorsal)) {
    aviso.hidden = false;
    aviso.innerHTML = `<strong>El dorsal ${estado.dorsal} no existe en esta carrera.</strong> Los dorsales van del 001 al ${tresCifras(DORSAL_MAX)}: revisa el número que llevabas en el pecho.`;
  } else if (estado.dorsal && !n) {
    aviso.hidden = false;
    aviso.innerHTML = `<strong>Aún no encontramos fotos con el dorsal ${tresCifras(estado.dorsal)}.</strong> Seguimos identificando corredores, así que vuelve más tarde. Mientras tanto, <button type="button" class="ver-todas" id="avisoTodas">mira todas las fotos</button>: puede que aparezcas en alguna.`;
    $("#avisoTodas").addEventListener("click", () => {
      estado.dorsal = "";
      $("#dorsal").value = "";
      aplicar(false);
    });
  } else {
    aviso.hidden = true;
  }
}

function pintarTanda() {
  const desde = estado.mostradas;
  const hasta = Math.min(desde + POR_TANDA, estado.lista.length);
  const frag = document.createDocumentFragment();
  for (let i = desde; i < hasta; i++) {
    const f = estado.lista[i];
    const b = document.createElement("button");
    b.type = "button";
    b.className = "foto";
    b.setAttribute("aria-label", `Ver foto ${i + 1}`);
    const img = new Image(f.w, f.h);
    img.loading = "lazy";
    img.decoding = "async";
    img.alt = "";
    img.onload = () => img.classList.add("cargada");
    img.src = mini(f);
    b.append(img);
    b.addEventListener("click", () => abrir(i));
    frag.append(b);
  }
  rejilla.append(frag);
  estado.mostradas = hasta;
}

new IntersectionObserver(
  (entradas) => {
    if (entradas[0].isIntersecting && estado.datos && estado.mostradas < estado.lista.length) pintarTanda();
  },
  { rootMargin: "1200px" }
).observe($("#centinela"));

/* ---------- Visor ---------- */
function abrir(i) {
  estado.actual = i;
  const f = estado.lista[i];
  visorImg.src = mini(f);
  const completa = new Image();
  completa.onload = () => {
    if (estado.lista[estado.actual] === f) visorImg.src = completa.src;
  };
  completa.src = hd(f);
  visorImg.alt = `Foto ${i + 1} de la Carrera Extrema`;
  const dorsales = f.d?.length ? ` · Dorsal ${f.d.map(tresCifras).join(", ")}` : "";
  $("#visorInfo").innerHTML = `<b>${i + 1}</b> de ${estado.lista.length}${dorsales}`;
  if (!visor.open) visor.showModal();
  actualizarUrl(f.id);
  // Precarga la siguiente para que pasar fotos sea instantáneo
  const sig = estado.lista[i + 1];
  if (sig) new Image().src = hd(sig);
}

function mover(paso) {
  const i = estado.actual + paso;
  if (i < 0 || i >= estado.lista.length) return;
  if (i >= estado.mostradas) pintarTanda();
  abrir(i);
}

$("#visorAnterior").addEventListener("click", () => mover(-1));
$("#visorSiguiente").addEventListener("click", () => mover(1));
$("#visorCerrar").addEventListener("click", () => visor.close());
visor.addEventListener("close", () => actualizarUrl());
visor.addEventListener("click", (e) => {
  if (e.target === visor || e.target.classList.contains("visor-escena")) visor.close();
});
document.addEventListener("keydown", (e) => {
  if (!visor.open || !panel.hidden) return;
  if (e.key === "ArrowLeft") mover(-1);
  if (e.key === "ArrowRight") mover(1);
});

let toqueX = null;
visorImg.addEventListener("touchstart", (e) => (toqueX = e.touches[0].clientX), { passive: true });
visorImg.addEventListener("touchend", (e) => {
  if (toqueX === null) return;
  const dx = e.changedTouches[0].clientX - toqueX;
  if (Math.abs(dx) > 50) mover(dx < 0 ? 1 : -1);
  toqueX = null;
});

/* ---------- Formatos para redes: Historia, Post, Cuadrado y Original ---------- */
const FORMATOS = {
  historia: { w: 1080, h: 1920 },
  post: { w: 1080, h: 1350 },
  cuadrado: { w: 1080, h: 1080 },
  original: null,
};
const panel = $("#formatos");
const lienzo = $("#formatosLienzo");
const ctx = lienzo.getContext("2d");
const logo = new Image();
logo.src = "assets/logo.png"; // si no existe, la historia usa el texto "CARRERA EXTREMA"
const fondo = new Image();
fondo.src = "assets/fondo.jpg";
const fmt = { foto: null, img: null, formato: "historia", modo: "completa", ox: 0.5, oy: 0.5, sobraX: 0, sobraY: 0 };

$("#visorDescargar").addEventListener("click", abrirFormatos);
$("#formatosCerrar").addEventListener("click", () => (panel.hidden = true));
visor.addEventListener("cancel", (e) => {
  if (!panel.hidden) {
    e.preventDefault();
    panel.hidden = true;
  }
});
visor.addEventListener("close", () => (panel.hidden = true));
document.querySelectorAll("[data-formato]").forEach((b) => b.addEventListener("click", () => elegirFormato(b.dataset.formato)));
document.querySelectorAll("[data-modo]").forEach((b) =>
  b.addEventListener("click", () => {
    fmt.modo = b.dataset.modo;
    fmt.ox = fmt.oy = 0.5;
    dibujar();
  })
);

async function abrirFormatos() {
  const f = estado.lista[estado.actual];
  panel.hidden = false;
  if (fmt.foto !== f) {
    fmt.foto = f;
    fmt.img = null;
    const img = new Image();
    img.src = hd(f);
    await Promise.all([img.decode(), document.fonts.load("64px Anton"), document.fonts.load("700 30px Montserrat"), logo.decode().catch(() => {}), fondo.decode().catch(() => {})]);
    if (fmt.foto !== f) return;
    fmt.img = img;
  }
  elegirFormato(fmt.formato);
}

function elegirFormato(id) {
  fmt.formato = id;
  const horizontal = fmt.img && fmt.img.naturalWidth > fmt.img.naturalHeight;
  // En historia, una foto horizontal recortada perdería a casi todos: por defecto se muestra completa
  fmt.modo = id === "historia" && horizontal ? "completa" : "llenar";
  fmt.ox = fmt.oy = 0.5;
  dibujar();
}

function dibujar() {
  document.querySelectorAll("[data-formato]").forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.formato === fmt.formato)));
  document.querySelectorAll("[data-modo]").forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.modo === fmt.modo)));
  $("#formatosAjuste").hidden = fmt.formato === "original";
  if (!fmt.img) return;
  const img = fmt.img;
  const { w, h } = FORMATOS[fmt.formato] ?? { w: img.naturalWidth, h: img.naturalHeight };
  lienzo.width = w;
  lienzo.height = h;
  if (fmt.formato === "original") {
    fmt.sobraX = fmt.sobraY = 0;
    ctx.drawImage(img, 0, 0);
  } else if (fmt.modo === "llenar") {
    componerRecorte(img, w, h);
  } else {
    componerCompleta(img, w, h);
  }
  const arrastrable = fmt.sobraX > 1 || fmt.sobraY > 1;
  $("#formatosPista").hidden = !arrastrable;
  lienzo.classList.toggle("arrastrable", arrastrable);
}

function componerRecorte(img, w, h) {
  const s = Math.max(w / img.naturalWidth, h / img.naturalHeight);
  const dw = img.naturalWidth * s, dh = img.naturalHeight * s;
  fmt.sobraX = dw - w;
  fmt.sobraY = dh - h;
  ctx.drawImage(img, -fmt.sobraX * fmt.ox, -fmt.sobraY * fmt.oy, dw, dh);
}

function componerCompleta(img, w, h) {
  fmt.sobraX = fmt.sobraY = 0;
  // Fondo: el degradado oficial de los artes de la carrera
  if (fondo.naturalWidth) {
    const sf = Math.max(w / fondo.naturalWidth, h / fondo.naturalHeight);
    ctx.drawImage(fondo, (w - fondo.naturalWidth * sf) / 2, (h - fondo.naturalHeight * sf) / 2, fondo.naturalWidth * sf, fondo.naturalHeight * sf);
  } else {
    fondoDesenfocado(img, w, h);
  }
  dibujarFotoYMarca(img, w, h);
}

// Respaldo si no cargó el degradado: la misma foto muy desenfocada
function fondoDesenfocado(img, w, h) {
  const mini = document.createElement("canvas");
  mini.width = 24;
  mini.height = Math.round((24 * h) / w);
  const mctx = mini.getContext("2d");
  const sf = Math.max(mini.width / img.naturalWidth, mini.height / img.naturalHeight);
  mctx.drawImage(img, (mini.width - img.naturalWidth * sf) / 2, (mini.height - img.naturalHeight * sf) / 2, img.naturalWidth * sf, img.naturalHeight * sf);
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(mini, 0, 0, w, h);
  ctx.fillStyle = "rgba(11, 11, 11, 0.5)";
  ctx.fillRect(0, 0, w, h);
}

function dibujarFotoYMarca(img, w, h) {
  const conMarca = fmt.formato === "historia";
  const margen = Math.round(w * 0.06);
  const altoMarca = conMarca ? 360 : 0;
  const s = Math.min((w - margen * 2) / img.naturalWidth, (h - margen * 2 - altoMarca) / img.naturalHeight);
  const dw = img.naturalWidth * s, dh = img.naturalHeight * s;
  const x = (w - dw) / 2, y = (h - dh - altoMarca) / 2;
  ctx.save();
  ctx.shadowColor = "rgba(0, 0, 0, 0.55)";
  ctx.shadowBlur = 40;
  ctx.shadowOffsetY = 12;
  ctx.beginPath();
  ctx.roundRect ? ctx.roundRect(x, y, dw, dh, 18) : ctx.rect(x, y, dw, dh);
  ctx.fillStyle = "#000";
  ctx.fill();
  ctx.restore();
  ctx.save();
  ctx.clip();
  ctx.drawImage(img, x, y, dw, dh);
  ctx.restore();

  if (conMarca) {
    ctx.textAlign = "center";
    let base = y + dh + 120;
    if (logo.naturalWidth) {
      // El logo ocupa como máximo 640×220 px y debajo va el Instagram
      const ls = Math.min(640 / logo.naturalWidth, 220 / logo.naturalHeight);
      const lw = logo.naturalWidth * ls, lh = logo.naturalHeight * ls;
      ctx.drawImage(logo, (w - lw) / 2, y + dh + 50, lw, lh);
      base = y + dh + 50 + lh - 4;
    } else {
      ctx.fillStyle = "#f5f1ea";
      ctx.font = "84px Anton";
      ctx.fillText("CARRERA EXTREMA", w / 2, base);
    }
    ctx.fillStyle = "#fdc80f";
    ctx.font = "700 32px Montserrat";
    ctx.fillText("@pacelab.club  ·  #CarreraExtrema", w / 2, base + 60);
  }
}

// Arrastrar para encuadrar el recorte
let arrastre = null;
lienzo.addEventListener("pointerdown", (e) => {
  if (!(fmt.sobraX > 1 || fmt.sobraY > 1)) return;
  arrastre = { x: e.clientX, y: e.clientY, ox: fmt.ox, oy: fmt.oy };
  lienzo.setPointerCapture(e.pointerId);
});
lienzo.addEventListener("pointermove", (e) => {
  if (!arrastre) return;
  const escala = lienzo.width / lienzo.getBoundingClientRect().width;
  const limita = (v) => Math.min(1, Math.max(0, v));
  if (fmt.sobraX > 1) fmt.ox = limita(arrastre.ox - ((e.clientX - arrastre.x) * escala) / fmt.sobraX);
  if (fmt.sobraY > 1) fmt.oy = limita(arrastre.oy - ((e.clientY - arrastre.y) * escala) / fmt.sobraY);
  dibujar();
});
lienzo.addEventListener("pointerup", () => (arrastre = null));
lienzo.addEventListener("pointercancel", () => (arrastre = null));

async function archivoFormato() {
  const f = fmt.foto;
  const nombre = `carrera-extrema-${f.id}-${fmt.formato}.jpg`;
  const blob =
    fmt.formato === "original"
      ? await fetch(hd(f)).then((r) => r.blob())
      : await new Promise((ok) => lienzo.toBlob(ok, "image/jpeg", 0.92));
  return new File([blob], nombre, { type: "image/jpeg" });
}

$("#formatosDescargar").addEventListener("click", async () => {
  if (!fmt.img) return;
  const archivo = await archivoFormato();
  const a = Object.assign(document.createElement("a"), { href: URL.createObjectURL(archivo), download: archivo.name });
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 10000);
});

// Compartir como archivo: en el celular abre directo Instagram, WhatsApp, etc.
const compartir = $("#formatosCompartir");
if (navigator.canShare?.({ files: [new File([""], "a.jpg", { type: "image/jpeg" })] })) {
  compartir.hidden = false;
  compartir.addEventListener("click", async () => {
    if (!fmt.img) return;
    try {
      await navigator.share({ files: [await archivoFormato()], text: "¡Lo viví! #CarreraExtrema @pacelab.club" });
    } catch {}
  });
}

/* ---------- Búsqueda y descarga en zip ---------- */
$("#buscador").addEventListener("submit", (e) => {
  e.preventDefault();
  estado.dorsal = normaliza($("#dorsal").value);
  $("#dorsal").blur();
  aplicar();
});
$("#verTodas").addEventListener("click", () => {
  estado.dorsal = "";
  $("#dorsal").value = "";
  aplicar();
});

$("#descargarTodas").addEventListener("click", async (e) => {
  const boton = e.currentTarget;
  if (!window.JSZip) return;
  const lista = estado.lista;
  boton.disabled = true;
  try {
    const zip = new JSZip();
    let hechas = 0;
    await Promise.all(
      lista.map(async (f) => {
        const blob = await fetch(hd(f)).then((r) => r.blob());
        zip.file(nombreDescarga(f), blob);
        boton.textContent = `Preparando… ${++hechas}/${lista.length}`;
      })
    );
    const archivo = await zip.generateAsync({ type: "blob", compression: "STORE" });
    const a = Object.assign(document.createElement("a"), {
      href: URL.createObjectURL(archivo),
      download: `carrera-extrema-dorsal-${tresCifras(estado.dorsal)}.zip`,
    });
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 10000);
  } finally {
    boton.disabled = false;
    boton.textContent = "Descargar todas (.zip)";
  }
});

function actualizarUrl(foto) {
  const p = new URLSearchParams();
  if (estado.dorsal) p.set("dorsal", tresCifras(estado.dorsal));
  if (foto) p.set("foto", foto);
  const hash = p.toString();
  history.replaceState(null, "", hash ? `#${hash}` : location.pathname + location.search);
}

iniciar();
