import { apiCliente } from './apiCliente';
import { RespuestaSesionActiva } from './autenticacionServicio';

export interface CredencialBiometricaItem {
  id: string;
  etiquetaDispositivo: string;
  transports: string[];
  ultimoUsoEn: string | null;
  creadoEn: string;
}

function base64UrlABuffer(base64url: string): ArrayBuffer {
  const base64 = base64url.replace(/-/g, '+').replace(/_/g, '/');
  const pad = '='.repeat((4 - (base64.length % 4)) % 4);
  const binario = atob(base64 + pad);
  const bytes = new Uint8Array(binario.length);
  for (let i = 0; i < binario.length; i++) {
    bytes[i] = binario.charCodeAt(i);
  }
  return bytes.buffer;
}

function bufferABase64Url(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binario = '';
  for (let i = 0; i < bytes.byteLength; i++) {
    binario += String.fromCharCode(bytes[i]);
  }
  return btoa(binario).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

/** Verifica si el navegador actual soporta WebAuthn (Huella / Face ID / Windows Hello) en contexto seguro. */
export function biometriaSoportada(): boolean {
  return (
    typeof window !== 'undefined' &&
    window.isSecureContext &&
    typeof window.PublicKeyCredential !== 'undefined' &&
    Boolean(navigator.credentials)
  );
}

export const biometriaServicio = {
  listarCredenciales: (
    tokenAcceso: string,
  ): Promise<{ credenciales: CredencialBiometricaItem[] }> =>
    apiCliente.get<{ credenciales: CredencialBiometricaItem[] }>(
      '/auth/biometria/credenciales',
      tokenAcceso,
    ),

  revocarCredencial: (id: string, tokenAcceso: string): Promise<{ mensaje: string }> =>
    apiCliente.delete<{ mensaje: string }>(
      `/auth/biometria/credenciales/${encodeURIComponent(id)}`,
      tokenAcceso,
    ),

  /** Registra la huella digital / Face ID / Windows Hello del dispositivo actual. */
  async registrarDispositivo(
    etiquetaDispositivo: string,
    tokenAcceso: string,
  ): Promise<CredencialBiometricaItem> {
    if (!biometriaSoportada()) {
      throw new Error(
        'La biometría (Huella / Face ID) requiere abrir HomeSOC por HTTPS (ej. tu enlace seguro de Tailscale).',
      );
    }

    const { opciones } = await apiCliente.post<{ opciones: Record<string, unknown> }>(
      '/auth/biometria/registrar/opciones',
      {},
      tokenAcceso,
    );

    const user = opciones.user as { id: string; name: string; displayName: string };
    const excludeCredentials = Array.isArray(opciones.excludeCredentials)
      ? (opciones.excludeCredentials as Array<{ id: string; type: PublicKeyCredentialType; transports?: AuthenticatorTransport[] }>).map(
          (c) => ({ ...c, id: base64UrlABuffer(c.id) }),
        )
      : [];

    const publicKey: PublicKeyCredentialCreationOptions = {
      ...(opciones as unknown as PublicKeyCredentialCreationOptions),
      challenge: base64UrlABuffer(String(opciones.challenge)),
      user: {
        ...user,
        id: base64UrlABuffer(user.id),
      },
      excludeCredentials,
    };

    const cred = (await navigator.credentials.create({
      publicKey,
    })) as PublicKeyCredential | null;

    if (!cred) {
      throw new Error('Registro biométrico cancelado por el usuario');
    }

    const attResp = cred.response as AuthenticatorAttestationResponse;
    const transports =
      typeof attResp.getTransports === 'function' ? attResp.getTransports() : [];

    const respuestaJson = {
      id: cred.id,
      rawId: bufferABase64Url(cred.rawId),
      type: cred.type,
      response: {
        clientDataJSON: bufferABase64Url(attResp.clientDataJSON),
        attestationObject: bufferABase64Url(attResp.attestationObject),
        transports,
      },
      clientExtensionResults: cred.getClientExtensionResults(),
    };

    const res = await apiCliente.post<{ credencial: CredencialBiometricaItem }>(
      '/auth/biometria/registrar/verificar',
      { respuesta: respuestaJson, etiquetaDispositivo },
      tokenAcceso,
    );
    return res.credencial;
  },

  /** Inicia sesión o completa 2FA usando Huella Digital / Face ID / Windows Hello. */
  async autenticarConBiometria(entrada: {
    nombreUsuario?: string;
    tokenTemporal2FA?: string;
    recordarSesionDias?: number;
  }): Promise<RespuestaSesionActiva> {
    if (!biometriaSoportada()) {
      throw new Error(
        'La biometría (Huella / Face ID) requiere abrir HomeSOC por HTTPS (tu enlace seguro de Tailscale).',
      );
    }

    const { opciones, challengeId } = await apiCliente.post<{
      opciones: Record<string, unknown>;
      challengeId: string;
    }>('/auth/biometria/login/opciones', {
      nombreUsuario: entrada.nombreUsuario?.trim() || undefined,
      tokenTemporal2FA: entrada.tokenTemporal2FA,
    });

    const allowCredentials = Array.isArray(opciones.allowCredentials)
      ? (opciones.allowCredentials as Array<{ id: string; type: PublicKeyCredentialType; transports?: AuthenticatorTransport[] }>).map(
          (c) => ({ ...c, id: base64UrlABuffer(c.id) }),
        )
      : undefined;

    const publicKey: PublicKeyCredentialRequestOptions = {
      ...(opciones as unknown as PublicKeyCredentialRequestOptions),
      challenge: base64UrlABuffer(String(opciones.challenge)),
      allowCredentials,
    };

    const assertion = (await navigator.credentials.get({
      publicKey,
    })) as PublicKeyCredential | null;

    if (!assertion) {
      throw new Error('Verificación biométrica cancelada');
    }

    const assertResp = assertion.response as AuthenticatorAssertionResponse;
    const respuestaJson = {
      id: assertion.id,
      rawId: bufferABase64Url(assertion.rawId),
      type: assertion.type,
      response: {
        clientDataJSON: bufferABase64Url(assertResp.clientDataJSON),
        authenticatorData: bufferABase64Url(assertResp.authenticatorData),
        signature: bufferABase64Url(assertResp.signature),
        userHandle: assertResp.userHandle ? bufferABase64Url(assertResp.userHandle) : undefined,
      },
      clientExtensionResults: assertion.getClientExtensionResults(),
    };

    return apiCliente.post<RespuestaSesionActiva>('/auth/biometria/login/verificar', {
      challengeId,
      respuesta: respuestaJson,
      recordarSesionDias: entrada.recordarSesionDias ?? 7,
    });
  },
};
