/**
 * Detecta y recorta automáticamente únicamente el cuadrado del código QR
 * dentro de una imagen exportada por bancos (Banco Ganadero, BNB, Banco Unión,
 * Mercantil, BCP, etc.), eliminando los marcos/textos del comprobante bancario
 * para que el QR ocupe todo el espacio y sea fácil de escanear en celular.
 *
 * Estrategia 100% en navegador (sin librerías externas):
 * 1. Usa la API nativa BarcodeDetector si el navegador la soporta.
 * 2. Respaldo universal en Canvas: detecta los 3 patrones de posición QR (1:1:3:1:1)
 *    horizontal y verticalmente para calcular el cuadrado exacto del QR.
 */

export interface ResultadoRecorteQr {
  dataUrl: string;
  imagenParaOcr: string;
  recortado: boolean;
  anchoOriginal: number;
  altoOriginal: number;
}

interface CentroFinder {
  x: number;
  y: number;
  u: number;
}

function coincideProporcion11311(r0: number, r1: number, r2: number, r3: number, r4: number): number {
  const total = r0 + r1 + r2 + r3 + r4;
  if (total < 14) return 0;
  const u = total / 7;
  if (u < 2 || u > 45) return 0;
  const tol = u * 0.55;
  if (
    Math.abs(r0 - u) < tol &&
    Math.abs(r1 - u) < tol &&
    Math.abs(r2 - 3 * u) < tol * 1.5 &&
    Math.abs(r3 - u) < tol &&
    Math.abs(r4 - u) < tol
  ) {
    return u;
  }
  return 0;
}

function detectarBboxPorFinders(
  bw: Uint8Array,
  w: number,
  h: number,
): { minX: number; minY: number; maxX: number; maxY: number } | null {
  const candidatos: CentroFinder[] = [];

  for (let y = 0; y < h; y += 3) {
    const offset = y * w;
    const starts: number[] = [];
    const ends: number[] = [];
    const vals: number[] = [];

    let curVal = bw[offset];
    let curStart = 0;
    for (let x = 1; x < w; x++) {
      const v = bw[offset + x];
      if (v !== curVal) {
        starts.push(curStart);
        ends.push(x);
        vals.push(curVal);
        curVal = v;
        curStart = x;
      }
    }
    starts.push(curStart);
    ends.push(w);
    vals.push(curVal);

    for (let i = 0; i <= vals.length - 5; i++) {
      if (vals[i] !== 1) continue;
      const u = coincideProporcion11311(
        ends[i] - starts[i],
        ends[i + 1] - starts[i + 1],
        ends[i + 2] - starts[i + 2],
        ends[i + 3] - starts[i + 3],
        ends[i + 4] - starts[i + 4],
      );
      if (u <= 0) continue;

      const cx = Math.floor((starts[i] + ends[i + 4]) / 2);

      // Verificación vertical sobre la columna cx alrededor de y
      const cStarts: number[] = [];
      const cEnds: number[] = [];
      const cVals: number[] = [];
      let cv = bw[cx];
      let cs = 0;
      for (let yy = 1; yy < h; yy++) {
        const v = bw[yy * w + cx];
        if (v !== cv) {
          cStarts.push(cs);
          cEnds.push(yy);
          cVals.push(cv);
          cv = v;
          cs = yy;
        }
      }
      cStarts.push(cs);
      cEnds.push(h);
      cVals.push(cv);

      let idx = -1;
      for (let k = 0; k < cEnds.length; k++) {
        if (y >= cStarts[k] && y < cEnds[k]) {
          idx = k;
          break;
        }
      }
      if (idx >= 2 && idx + 2 < cVals.length && cVals[idx] === 1) {
        const uv = coincideProporcion11311(
          cEnds[idx - 2] - cStarts[idx - 2],
          cEnds[idx - 1] - cStarts[idx - 1],
          cEnds[idx] - cStarts[idx],
          cEnds[idx + 1] - cStarts[idx + 1],
          cEnds[idx + 2] - cStarts[idx + 2],
        );
        if (uv > 0 && Math.abs(uv - u) < u * 0.5) {
          const cy = Math.floor((cStarts[idx - 2] + cEnds[idx + 2]) / 2);
          candidatos.push({ x: cx, y: cy, u: (u + uv) / 2 });
        }
      }
    }
  }

  // Agrupar candidatos cercanos en los 3 patrones de esquina del QR
  const grupos: { x: number; y: number; u: number; puntos: CentroFinder[] }[] = [];
  for (const c of candidatos) {
    let agregado = false;
    for (const g of grupos) {
      if (Math.abs(g.x - c.x) < c.u * 4 && Math.abs(g.y - c.y) < c.u * 4) {
        g.puntos.push(c);
        const n = g.puntos.length;
        g.x = g.puntos.reduce((a, p) => a + p.x, 0) / n;
        g.y = g.puntos.reduce((a, p) => a + p.y, 0) / n;
        g.u = g.puntos.reduce((a, p) => a + p.u, 0) / n;
        agregado = true;
        break;
      }
    }
    if (!agregado) {
      grupos.push({ x: c.x, y: c.y, u: c.u, puntos: [c] });
    }
  }

  const validos = grupos.filter((g) => g.puntos.length >= 2).sort((a, b) => b.puntos.length - a.puntos.length);
  if (validos.length < 3) return null;

  const top3 = validos.slice(0, 3);
  const minX = Math.min(...top3.map((g) => g.x - 3.5 * g.u));
  const minY = Math.min(...top3.map((g) => g.y - 3.5 * g.u));
  const maxX = Math.max(...top3.map((g) => g.x + 3.5 * g.u));
  const maxY = Math.max(...top3.map((g) => g.y + 3.5 * g.u));

  const ancho = maxX - minX;
  const alto = maxY - minY;
  if (ancho < 60 || alto < 60) return null;

  return { minX, minY, maxX, maxY };
}

async function detectarConBarcodeApi(
  img: HTMLImageElement,
): Promise<{ minX: number; minY: number; maxX: number; maxY: number } | null> {
  const win = window as unknown as {
    BarcodeDetector?: new (opts: { formats: string[] }) => {
      detect: (src: ImageBitmapSource) => Promise<
        Array<{ boundingBox?: { x: number; y: number; width: number; height: number } }>
      >;
    };
  };
  if (typeof win.BarcodeDetector !== 'function') return null;
  try {
    const detector = new win.BarcodeDetector({ formats: ['qr_code'] });
    const resultados = await detector.detect(img);
    const box = resultados[0]?.boundingBox;
    if (!box || box.width < 50 || box.height < 50) return null;
    return {
      minX: box.x,
      minY: box.y,
      maxX: box.x + box.width,
      maxY: box.y + box.height,
    };
  } catch {
    return null;
  }
}

function cargarImagen(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('No se pudo leer la imagen seleccionada'));
    img.src = src;
  });
}

/**
 * Recibe un archivo de imagen de QR bancario, detecta la matriz del QR y devuelve
 * un dataUrl cuadrado (560x560) centrado únicamente en el QR con margen blanco limpio.
 */
export async function recortarQrBancarioDesdeArchivo(archivo: File): Promise<ResultadoRecorteQr> {
  const rawUrl = await new Promise<string>((resolve, reject) => {
    const lector = new FileReader();
    lector.onload = () => (typeof lector.result === 'string' ? resolve(lector.result) : reject(new Error('Lectura inválida')));
    lector.onerror = () => reject(new Error('No se pudo leer el archivo'));
    lector.readAsDataURL(archivo);
  });

  const img = await cargarImagen(rawUrl);
  const wOrig = img.naturalWidth || img.width;
  const hOrig = img.naturalHeight || img.height;

  // 1) Intento rápido con BarcodeDetector nativo (Chrome / Edge / Android)
  let bbox = await detectarConBarcodeApi(img);

  // 2) Respaldo universal: detección pura de los 3 patrones QR (1:1:3:1:1)
  if (!bbox) {
    const escala = Math.min(1, 900 / Math.max(wOrig, hOrig));
    const sw = Math.max(1, Math.round(wOrig * escala));
    const sh = Math.max(1, Math.round(hOrig * escala));
    const work = document.createElement('canvas');
    work.width = sw;
    work.height = sh;
    const wctx = work.getContext('2d', { willReadFrequently: true });
    if (wctx) {
      wctx.fillStyle = '#ffffff';
      wctx.fillRect(0, 0, sw, sh);
      wctx.drawImage(img, 0, 0, sw, sh);
      const { data } = wctx.getImageData(0, 0, sw, sh);
      const bw = new Uint8Array(sw * sh);
      for (let i = 0, p = 0; i < bw.length; i++, p += 4) {
        const lum = 0.299 * data[p] + 0.587 * data[p + 1] + 0.114 * data[p + 2];
        bw[i] = lum < 120 ? 1 : 0;
      }
      const found = detectarBboxPorFinders(bw, sw, sh);
      if (found) {
        bbox = {
          minX: found.minX / escala,
          minY: found.minY / escala,
          maxX: found.maxX / escala,
          maxY: found.maxY / escala,
        };
      }
    }
  }

  // Genera imagen ligera para OCR (máx 900px) ocultando la matriz QR con blanco para acelerar y mejorar la lectura del texto
  const generarImagenOcr = (
    box: { minX: number; minY: number; maxX: number; maxY: number } | null,
  ): string => {
    const esc = Math.min(1, 900 / Math.max(wOrig, hOrig));
    const ow = Math.max(1, Math.round(wOrig * esc));
    const oh = Math.max(1, Math.round(hOrig * esc));
    const oc = document.createElement('canvas');
    oc.width = ow;
    oc.height = oh;
    const ctx = oc.getContext('2d');
    if (!ctx) return rawUrl;
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, ow, oh);
    ctx.drawImage(img, 0, 0, ow, oh);
    if (box) {
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(
        Math.floor(box.minX * esc),
        Math.floor(box.minY * esc),
        Math.ceil((box.maxX - box.minX) * esc),
        Math.ceil((box.maxY - box.minY) * esc),
      );
    }
    return oc.toDataURL('image/jpeg', 0.88);
  };

  const imagenParaOcr = generarImagenOcr(bbox);

  if (!bbox) {
    return {
      dataUrl: rawUrl,
      imagenParaOcr,
      recortado: false,
      anchoOriginal: wOrig,
      altoOriginal: hOrig,
    };
  }

  // Recorte exacto al cuadrado del QR (sin absorber bordes del banco) + margen blanco limpio en el lienzo destino
  const bwReal = bbox.maxX - bbox.minX;
  const bhReal = bbox.maxY - bbox.minY;
  const lado = Math.max(bwReal, bhReal);
  const cx = (bbox.minX + bbox.maxX) / 2;
  const cy = (bbox.minY + bbox.maxY) / 2;

  const sx = Math.max(0, Math.floor(cx - lado / 2));
  const sy = Math.max(0, Math.floor(cy - lado / 2));
  const sLado = Math.min(wOrig - sx, hOrig - sy, Math.ceil(lado));

  const outSize = 560;
  const margenBlanco = Math.round(outSize * 0.05);
  const innerSize = outSize - margenBlanco * 2;
  const out = document.createElement('canvas');
  out.width = outSize;
  out.height = outSize;
  const octx = out.getContext('2d');
  if (!octx) {
    return {
      dataUrl: rawUrl,
      imagenParaOcr,
      recortado: false,
      anchoOriginal: wOrig,
      altoOriginal: hOrig,
    };
  }

  octx.fillStyle = '#ffffff';
  octx.fillRect(0, 0, outSize, outSize);
  octx.imageSmoothingEnabled = false;
  octx.drawImage(img, sx, sy, sLado, sLado, margenBlanco, margenBlanco, innerSize, innerSize);

  // PNG nítido si pesa poco, o JPEG alta calidad si excede 220 KB
  let dataUrl = out.toDataURL('image/png');
  if (dataUrl.length > 300_000) {
    dataUrl = out.toDataURL('image/jpeg', 0.92);
  }

  return { dataUrl, imagenParaOcr, recortado: true, anchoOriginal: wOrig, altoOriginal: hOrig };
}
