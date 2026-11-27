export interface ServicioTotp {
  generarSecretoBase32(): string;
  construirUriOtpAuth(nombreUsuario: string, secretoBase32: string): string;
  generarQrDataUrl(uriOtpAuth: string): Promise<string>;
  verificarCodigo(secretoBase32: string, codigo: string): boolean;
  generarCodigosRecuperacion(cantidad?: number): string[];
}
