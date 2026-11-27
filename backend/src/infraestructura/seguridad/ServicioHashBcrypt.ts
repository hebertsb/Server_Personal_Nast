import bcrypt from 'bcryptjs';
import { ServicioHashContrasena } from '../../dominio/interfaces/ServicioHashContrasena';

const RONDAS_SALT = 12;

export class ServicioHashBcrypt implements ServicioHashContrasena {
  public async generarHash(textoPlano: string): Promise<string> {
    return bcrypt.hash(textoPlano, RONDAS_SALT);
  }

  public async verificar(textoPlano: string, hash: string): Promise<boolean> {
    return bcrypt.compare(textoPlano, hash);
  }
}
