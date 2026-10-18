"""Lee los números de dorsal de las fotos con OCR (RapidOCR, corre en la PC, sin internet).

Uso (lo llama procesar-fotos.mjs; también se puede correr solo):
    .venv/Scripts/python detectar-dorsales.py site/fotos/hd dorsales-auto.json 300

Guarda el resultado en dorsales-auto.json para no volver a leer fotos que no cambiaron.
Reparte el trabajo entre varios procesos para aprovechar todos los núcleos del procesador.
"""
import json
import os
import re
import sys
import time
from multiprocessing import Pool

CONFIANZA_MINIMA = 0.5
# Cada proceso usa 4 hilos; con 16 núcleos salen 4 procesos en paralelo
HILOS_POR_PROCESO = 4

_ocr = None
_maximo = 300


def iniciar_proceso(maximo):
    global _ocr, _maximo
    from rapidocr_onnxruntime import RapidOCR

    _maximo = maximo
    try:
        _ocr = RapidOCR(intra_op_num_threads=HILOS_POR_PROCESO)
    except TypeError:
        _ocr = RapidOCR()


def leer_dorsales(tarea):
    id_foto, ruta, mtime = tarea
    resultado, _ = _ocr(ruta)
    encontrados = set()
    for _caja, texto, confianza in resultado or []:
        # Los dorsales siempre tienen 3 cifras; el OCR a veces confunde 0 con O
        t = texto.strip().upper().replace(" ", "").replace("O", "0")
        if float(confianza) >= CONFIANZA_MINIMA and re.fullmatch(r"\d{3}", t) and 1 <= int(t) <= _maximo:
            encontrados.add(str(int(t)))
    return id_foto, mtime, sorted(encontrados, key=int)


def main():
    carpeta, ruta_cache, maximo = sys.argv[1], sys.argv[2], int(sys.argv[3])
    try:
        with open(ruta_cache, encoding="utf8") as f:
            cache = json.load(f)
    except (FileNotFoundError, json.JSONDecodeError):
        cache = {}

    fotos = sorted(f for f in os.listdir(carpeta) if f.lower().endswith(".jpg"))
    if not sys.stdin.isatty():
        # procesar-fotos.mjs manda por stdin la lista de fotos vigentes
        ids = set(json.load(sys.stdin))
        fotos = [f for f in fotos if os.path.splitext(f)[0] in ids]

    pendientes = []
    for archivo in fotos:
        id_foto = os.path.splitext(archivo)[0]
        mtime = int(os.path.getmtime(os.path.join(carpeta, archivo)))
        if cache.get(id_foto, {}).get("m") != mtime:
            pendientes.append((id_foto, os.path.join(carpeta, archivo), mtime))

    # Quita del caché las fotos que ya no existen
    vigentes = {os.path.splitext(a)[0] for a in fotos}
    cache = {k: v for k, v in cache.items() if k in vigentes}

    if pendientes:
        procesos = max(1, min(len(pendientes), (os.cpu_count() or 4) // HILOS_POR_PROCESO))
        print(f"  Leyendo dorsales de {len(pendientes)} fotos nuevas con {procesos} procesos...")
        inicio = time.time()
        with Pool(procesos, initializer=iniciar_proceso, initargs=(maximo,)) as pool:
            for n, (id_foto, mtime, dorsales) in enumerate(pool.imap_unordered(leer_dorsales, pendientes), 1):
                cache[id_foto] = {"m": mtime, "d": dorsales}
                restante = (time.time() - inicio) / n * (len(pendientes) - n)
                print(f"\r  {n}/{len(pendientes)} fotos - faltan ~{restante / 60:.0f} min   ", end="", flush=True)
                if n % 20 == 0:
                    guardar(ruta_cache, cache)
        print()
    guardar(ruta_cache, cache)


def guardar(ruta, cache):
    with open(ruta, "w", encoding="utf8") as f:
        json.dump(cache, f, ensure_ascii=False, indent=0)


if __name__ == "__main__":
    main()
