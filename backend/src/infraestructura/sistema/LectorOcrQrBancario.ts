import { spawn } from 'child_process';

export interface DatosQrBancarioOcr {
  banco: string;
  titular: string;
  numeroCuenta: string;
  textoDetectado: string;
}

const BANCOS_BOLIVIA: Array<{ patron: RegExp; nombre: string }> = [
  { patron: /BANCO\s+GANADERO|\bGANADERO\b/i, nombre: 'Banco Ganadero' },
  { patron: /\bBNB\b|BANCO\s+NACIONAL\s+DE\s+BOLIVIA/i, nombre: 'Banco Nacional de Bolivia (BNB)' },
  { patron: /BANCO\s+UNI[OÓ]N/i, nombre: 'Banco Unión' },
  { patron: /MERCANTIL|\bBMSC\b/i, nombre: 'Banco Mercantil Santa Cruz' },
  { patron: /\bBCP\b|CR[EÉ]DITO\s+DE\s+BOLIVIA/i, nombre: 'Banco de Crédito BCP' },
  { patron: /\bBISA\b/i, nombre: 'Banco BISA' },
  { patron: /ECON[OÓ]MICO|\bBEC\b/i, nombre: 'Banco Económico' },
  { patron: /\bFIE\b/i, nombre: 'Banco FIE' },
  { patron: /BANCOSOL|BANCO\s+SOL/i, nombre: 'BancoSol' },
  { patron: /FORTALEZA/i, nombre: 'Banco Fortaleza' },
  { patron: /\bYAPE\b/i, nombre: 'Yape Bolivia' },
  { patron: /TIGO\s*MONEY/i, nombre: 'Tigo Money' },
];

const PALABRAS_EXCLUIDAS_TITULAR =
  /\b(BANCO|GANADERO|BNB|UNION|UNIÓN|MERCANTIL|BCP|BISA|ECONOMICO|ECONÓMICO|FIE|SOL|FORTALEZA|YAPE|MONTO|CUENTA|ABONO|DESTINO|CONCEPTO|PAGO|SUSCRIPCION|SUSCRIPCIÓN|VENCE|VALIDO|VÁLIDO|HASTA|ESPECIFICAR|SIMPLE|BOLIVIA|NOVIEMBRE|DICIEMBRE|ENERO|FEBRERO|MARZO|ABRIL|MAYO|JUNIO|JULIO|AGOSTO|SEPTIEMBRE|OCTUBRE|BS)\b/i;

function aTitulo(texto: string): string {
  const limpio = texto.replace(/\s+/g, ' ').trim();
  if (!limpio) return '';
  // Si viene todo en MAYÚSCULAS, lo pasamos a Formato Título
  if (limpio === limpio.toUpperCase()) {
    return limpio
      .toLowerCase()
      .split(' ')
      .map((p) => (p.length > 0 ? p[0].toUpperCase() + p.slice(1) : ''))
      .join(' ');
  }
  return limpio;
}

/**
 * Extrae Banco, Titular y Número de cuenta desde el texto crudo devuelto por OCR
 * sobre comprobantes QR de bancos de Bolivia.
 */
export function parsearTextoOcrQrBancario(textoOcr: string): DatosQrBancarioOcr {
  const lineas = textoOcr
    .split(/\r?\n/)
    .map((l) => l.replace(/[|_~`]+/g, ' ').replace(/\s+/g, ' ').trim())
    .filter((l) => l.length >= 2);

  const textoCompleto = lineas.join('\n');

  // 1. Detectar Banco
  let banco = '';
  for (const item of BANCOS_BOLIVIA) {
    if (item.patron.test(textoCompleto)) {
      banco = item.nombre;
      break;
    }
  }
  if (!banco) {
    const lineaBanco = lineas.find((l) => /\bBANCO\b/i.test(l) && l.length <= 50);
    if (lineaBanco) banco = aTitulo(lineaBanco);
  }

  // 2. Detectar Número de Cuenta
  let numeroCuenta = '';
  const matchCuentaEtiquetada = textoCompleto.match(
    /(?:cuenta(?:\s+de\s+abono|\s+destino|\s+nro\.?|\s+n[uú]mero)?|cta\.?)\s*[:\-]?\s*(?:(?:CA|CC|AHO)\s+)?([0-9][0-9\- ]{6,20})/i,
  );
  if (matchCuentaEtiquetada?.[1]) {
    numeroCuenta = matchCuentaEtiquetada[1].replace(/\s+/g, '').trim();
  } else {
    const matchCaCc = textoCompleto.match(/\b(?:CA|CC)\s+([0-9]{7,18})\b/i);
    if (matchCaCc?.[1]) {
      numeroCuenta = matchCaCc[1].trim();
    } else {
      const matchLargo = textoCompleto.match(/\b([0-9]{8,16})\b/);
      if (matchLargo?.[1]) {
        numeroCuenta = matchLargo[1].trim();
      }
    }
  }

  // 3. Detectar Titular
  let titular = '';
  const matchTitularEtiquetado = textoCompleto.match(
    /(?:pagar\s+a|titular|beneficiario|destinatario|a\s+nombre\s+de)\s*[:\-]\s*([A-Za-zÁÉÍÓÚÑáéíóúñ ]{4,60})/i,
  );
  if (matchTitularEtiquetado?.[1]) {
    titular = aTitulo(matchTitularEtiquetado[1]);
  } else {
    // Respaldo (ej. Banco Ganadero donde el nombre va solo en una línea entre Bs y Cuenta)
    for (const linea of lineas) {
      if (/[0-9:$€£]/.test(linea)) continue;
      if (PALABRAS_EXCLUIDAS_TITULAR.test(linea)) continue;
      if (!/^[A-Za-zÁÉÍÓÚÑáéíóúñ ]{5,55}$/.test(linea)) continue;
      const palabras = linea.split(' ').filter((w) => w.length >= 2);
      if (palabras.length >= 2 && palabras.length <= 5) {
        titular = aTitulo(linea);
        break;
      }
    }
  }

  return {
    banco,
    titular,
    numeroCuenta,
    textoDetectado: textoCompleto.slice(0, 600),
  };
}

function ejecutarTesseractEnBuffer(buffer: Buffer): Promise<string> {
  return new Promise((resolve, reject) => {
    const proc = spawn('tesseract', ['stdin', 'stdout', '-l', 'spa', '--psm', '6'], {
      stdio: ['pipe', 'pipe', 'pipe'],
    });
    const chunks: Buffer[] = [];
    let errText = '';
    const timer = setTimeout(() => {
      proc.kill('SIGKILL');
      reject(new Error('Tiempo agotado ejecutando OCR'));
    }, 10_000);

    proc.stdout.on('data', (c: Buffer) => chunks.push(c));
    proc.stderr.on('data', (c: Buffer) => {
      errText += c.toString('utf8');
    });
    proc.on('error', (err) => {
      clearTimeout(timer);
      reject(err);
    });
    proc.on('close', (code) => {
      clearTimeout(timer);
      if (code !== 0) {
        reject(new Error(errText.trim() || `tesseract salió con código ${code}`));
        return;
      }
      resolve(Buffer.concat(chunks).toString('utf8'));
    });

    proc.stdin.write(buffer);
    proc.stdin.end();
  });
}

/**
 * Ejecuta OCR offline (Tesseract) sobre una imagen DataURL de QR bancario
 * y retorna Banco, Titular y Número de Cuenta detectados.
 */
export async function extraerDatosQrBancarioConOcr(
  imagenDataUrl: string,
): Promise<DatosQrBancarioOcr> {
  const match = imagenDataUrl.match(/^data:image\/(png|jpeg|jpg|webp);base64,(.+)$/i);
  if (!match?.[2]) {
    return { banco: '', titular: '', numeroCuenta: '', textoDetectado: '' };
  }
  const buffer = Buffer.from(match[2], 'base64');
  if (buffer.length === 0 || buffer.length > 900_000) {
    return { banco: '', titular: '', numeroCuenta: '', textoDetectado: '' };
  }
  try {
    const texto = await ejecutarTesseractEnBuffer(buffer);
    return parsearTextoOcrQrBancario(texto);
  } catch {
    return { banco: '', titular: '', numeroCuenta: '', textoDetectado: '' };
  }
}
