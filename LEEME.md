# Fotos · Carrera Extrema Sportline

Página para que los corredores busquen su número de dorsal y descarguen sus fotos.

## Estructura

```
fotos-originales/        ← aquí van todas las fotos de los fotógrafos, sin subcarpetas
dorsales.csv             ← correcciones a mano de los dorsales (opcional)
procesar-fotos.mjs       ← genera las versiones web, lee los dorsales y arma el índice
detectar-dorsales.py     ← lector automático de dorsales (OCR, corre en la PC)
site/                    ← ESTA carpeta es la que se publica
  index.html, styles.css, app.js
  assets/                ← logo, fondos y piezas de los artes oficiales
  fotos/ y fotos.json    ← se generan solos
```

## Lector automático de dorsales

`npm run fotos` lee los números de los dorsales en cada foto con RapidOCR. Corre en la PC, es gratis y no
necesita internet. Solo acepta números de 3 cifras entre 001 y 300, así descarta lecturas falsas.
Tarda unos 2–3 segundos por foto la primera vez: 1 000 fotos son unos 45 minutos. Recuerda lo que ya leyó
(`dorsales-auto.json`), así que con cada tanda nueva solo lee las fotos nuevas.

Se instala una sola vez en cada computadora (requiere Python 3):
```
npm run instalar-lector
```

En las pruebas encontró 21 de 24 dorsales visibles. Se le escapan los muy tapados por lodo o en ángulo.

**Corregir a mano:** anota la foto en `dorsales.csv`. Lo que diga el CSV reemplaza a la lectura automática
de esa foto, y si dejas los dorsales vacíos se le quitan:
```
archivo,dorsales
IMG_3548.jpg,087
IMG_3643.jpg,099 098
IMG_3366.jpg,
```
También puedes renombrar el archivo con el dorsal: `IMG_3195_d038-039.jpg`.

## Día del evento

1. Copia las fotos directamente en `fotos-originales/`.
2. Ejecuta `npm run fotos`. Solo procesa las fotos nuevas, así que puedes repetirlo con cada tanda.
3. Ejecuta `npm run ver` y abre http://localhost:4321 para revisar. Si un corredor reporta que no se
   encuentra, corrige en `dorsales.csv` y vuelve a ejecutar `npm run fotos`.
4. Publica con `npm run deploy` y luego `npm run publicar` (ver abajo).

## Publicar

La web está repartida en dos lugares porque las fotos no caben en el límite de 1 GB de GitHub Pages:

| Qué | Dónde | Comando |
|---|---|---|
| Página (HTML, estilos, buscador, `fotos.json`) | GitHub Pages → https://fotos.pacelabpanama.com | `npm run publicar` |
| Fotos (`site/fotos/`) | Cloudflare (Worker en la cuenta de is.cinyak), hasta ~10 000 fotos | `npm run deploy` |

Con cada tanda nueva de fotos:
```
npm run fotos      # versiones web + lectura de dorsales
npm run deploy     # sube a Cloudflare solo las fotos nuevas
npm run publicar   # publica la página con el nuevo fotos.json
```
Siempre en ese orden: primero las fotos y después la página, para que nunca aparezca una foto que todavía no está subida.

- El dominio `fotos.pacelabpanama.com` es un CNAME a `iscinyak.github.io` en el Cloudflare de PACELAB, con el proxy activado (nube naranja) para el HTTPS.
- `npm run publicar` le pone una versión a `app.js` y `styles.css`, porque Cloudflare guarda esos archivos por horas.
- `site/_headers` da permiso (CORS) para que la página descargue las fotos de Cloudflare para el zip y los formatos.
- El repositorio no guarda `site/fotos/`: las fotos solo están en tu PC y en Cloudflare.

## Antes del evento: borrar las fotos de prueba

Borra el contenido de `fotos-originales/`, la carpeta `site/fotos/`, `site/fotos.json` y `dorsales.csv`.
Si publicas sin fotos, la página muestra "¡Las fotos vienen en camino!".
