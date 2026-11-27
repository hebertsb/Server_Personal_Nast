export interface ServicioHashContrasena {
  generarHash(textoPlano: string): Promise<string>;
  verificar(textoPlano: string, hash: string): Promise<boolean>;
}
