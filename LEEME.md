# Fotos · Carrera Extrema Sportline

Página para que los corredores busquen su número de dorsal y descarguen sus fotos.

## Estructura

```
fotos-originales/        ← aquí van todas las fotos de los fotógrafos, sin subcarpetas
dorsales.csv             ← (opcional) qué dorsales aparecen en cada foto
procesar-fotos.mjs       ← genera las versiones web y el índice
site/                    ← ESTA carpeta es la que se publica
  index.html, styles.css, app.js
  assets/logo.png        ← pon aquí el logo (PNG transparente, fondo oscuro)
  assets/portada.jpg     ← imagen de fondo de la portada
  fotos/ y fotos.json    ← se generan solos
```

## Día del evento

1. Copia las fotos directamente en `fotos-originales/`.
2. (Opcional) Llena `dorsales.csv`:
   ```
   archivo,dorsales
   IMG_3195.jpg,038 039
   IMG_3215.jpg,112
   ```
   También puedes renombrar el archivo con el dorsal: `IMG_3195_d038-039.jpg`.
3. Ejecuta `npm run fotos`. Solo procesa las fotos nuevas, así que puedes repetirlo cada vez que llegue otra tanda.
4. Ejecuta `npm run ver` y abre http://localhost:4321 para revisar.
5. Publica la carpeta `site/`.

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
