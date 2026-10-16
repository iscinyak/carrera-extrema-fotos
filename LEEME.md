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
4. Publica con `npm run deploy`.

## Publicar en Cloudflare (gratis)

La página se sirve como un Worker con archivos estáticos (la versión nueva de Cloudflare Pages).
No cobra por tráfico y admite hasta 20 000 archivos (unas 10 000 fotos).

```
npm run deploy
```

Publica la carpeta `site/` según `wrangler.jsonc`. La dirección es
https://carrera-extrema-fotos.carrera-extrema-fotos.workers.dev
Para actualizar, repite `npm run fotos` y `npm run deploy`. Los restos de la primera prueba no se suben
porque están listados en `site/.assetsignore`.

## Vista previa en GitHub Pages (para revisión del cliente)

La carpeta `site/` se publica en la rama `gh-pages`:
https://iscinyak.github.io/carrera-extrema-fotos/

Para actualizarla después de hacer cambios:
```
git add -A && git commit -m "Cambios" && git push && npm run publicar
```
GitHub Pages tiene un límite de 1 GB y de 100 GB de tráfico al mes. Sirve para la revisión,
pero el día del evento conviene usar Cloudflare Pages.

## Antes del evento: borrar las fotos de prueba

Borra el contenido de `fotos-originales/`, la carpeta `site/fotos/`, `site/fotos.json` y `dorsales.csv`.
Si publicas sin fotos, la página muestra "¡Las fotos vienen en camino!".
