import crypto from 'node:crypto';
import { ServicioCifrado } from '../../dominio/interfaces/ServicioCifrado';

const ALGORITMO = 'aes-256-gcm';
const LONGITUD_IV = 12;

/**
 * Cifrado autenticado AES-256-GCM en reposo (RNF-SEC-15).
 * Usa una clave separada de la base de datos inyectada vía variable de entorno.
 */
export class ServicioCifradoAes implements ServicioCifrado {
  private readonly clave: Buffer;

  constructor(claveMaestra: string) {
    this.clave = crypto.createHash('sha256').update(claveMaestra, 'utf8').digest();
  }

  public cifrar(textoPlano: string): string {
    const iv = crypto.randomBytes(LONGITUD_IV);
    const cifrador = crypto.createCipheriv(ALGORITMO, this.clave, iv);
    const cifrado = Buffer.concat([cifrador.update(textoPlano, 'utf8'), cifrador.final()]);
    const tag = cifrador.getAuthTag();

    return `${iv.toString('base64')}:${tag.toString('base64')}:${cifrado.toString('base64')}`;
  }

  public descifrar(textoCifrado: string): string {
    const partes = textoCifrado.split(':');
    if (partes.length !== 3) {
      throw new Error('Formato de dato cifrado inválido');
    }

    const [ivB64, tagB64, datosB64] = partes;
    const iv = Buffer.from(ivB64, 'base64');
    const tag = Buffer.from(tagB64, 'base64');
    const datos = Buffer.from(datosB64, 'base64');

    const descifrador = crypto.createDecipheriv(ALGORITMO, this.clave, iv);
    descifrador.setAuthTag(tag);

    return Buffer.concat([descifrador.update(datos), descifrador.final()]).toString('utf8');
  }
}
