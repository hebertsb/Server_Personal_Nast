import { Pool } from 'pg';
import { InvitacionUsuario, RolInvitacion } from '../../dominio/entidades/InvitacionUsuario';
import {
  MODULOS_SISTEMA,
  ModuloSistema,
  PERMISOS_POR_DEFECTO_ROL,
  RolUsuario,
  Usuario,
} from '../../dominio/entidades/Usuario';
import {
  CrearInvitacionDatos,
  CrearUsuarioDatos,
  IntentoInicioSesionDatos,
  RepositorioUsuarios,
} from '../../dominio/interfaces/RepositorioUsuarios';

interface FilaUsuario {
  id: string;
  nombre_usuario: string;
  hash_contrasena: string;
  rol: RolUsuario;
  secreto_totp: string | null;
  totp_habilitado: boolean;
  creado_en: Date;
  activo: boolean;
  permisos_modulos: unknown;
  ultimo_acceso_en: Date | null;
  ultima_ip_acceso: string | null;
  version_sesion: number;
}

interface FilaInvitacion {
  id: string;
  prefijo_token: string;
  rol: RolInvitacion;
  permisos_modulos: unknown;
  nota: string | null;
  creado_por_id: string | null;
  expira_en: Date;
  usado_en: Date | null;
  usado_por_id: string | null;
  usado_por_nombre?: string | null;
  revocada: boolean;
  creado_en: Date;
}

const SET_MODULOS = new Set<string>(MODULOS_SISTEMA);

function normalizarPermisos(valor: unknown, rol: RolUsuario): ModuloSistema[] {
  if (rol === 'superadmin') return [...MODULOS_SISTEMA];
  if (Array.isArray(valor)) {
    const filtrados = valor.filter(
      (m): m is ModuloSistema => typeof m === 'string' && SET_MODULOS.has(m),
    );
    if (filtrados.length > 0) return filtrados;
  }
  return [...PERMISOS_POR_DEFECTO_ROL[rol]];
}

function mapearFilaAUsuario(fila: FilaUsuario): Usuario {
  return new Usuario({
    id: fila.id,
    nombreUsuario: fila.nombre_usuario,
    hashContrasena: fila.hash_contrasena,
    rol: fila.rol,
    secretoTotp: fila.secreto_totp,
    totpHabilitado: fila.totp_habilitado,
    creadoEn: new Date(fila.creado_en),
    activo: fila.activo ?? true,
    permisosModulos: normalizarPermisos(fila.permisos_modulos, fila.rol),
    ultimoAccesoEn: fila.ultimo_acceso_en ? new Date(fila.ultimo_acceso_en) : null,
    ultimaIpAcceso: fila.ultima_ip_acceso ?? null,
    versionSesion: Number(fila.version_sesion ?? 1),
  });
}

function mapearFilaAInvitacion(fila: FilaInvitacion): InvitacionUsuario {
  return {
    id: fila.id,
    prefijoToken: fila.prefijo_token,
    rol: fila.rol,
    permisosModulos: normalizarPermisos(fila.permisos_modulos, fila.rol),
    nota: fila.nota,
    creadoPorId: fila.creado_por_id,
    expiraEn: new Date(fila.expira_en),
    usadoEn: fila.usado_en ? new Date(fila.usado_en) : null,
    usadoPorId: fila.usado_por_id,
    usadoPorNombre: fila.usado_por_nombre ?? null,
    revocada: fila.revocada,
    creadoEn: new Date(fila.creado_en),
  };
}

const COLUMNAS_USUARIO = `id, nombre_usuario, hash_contrasena, rol, secreto_totp, totp_habilitado,
  creado_en, activo, permisos_modulos, ultimo_acceso_en, ultima_ip_acceso, version_sesion`;

/** Implementación PostgreSQL de RepositorioUsuarios usando exclusivamente queries parametrizadas. */
export class RepositorioUsuariosPostgres implements RepositorioUsuarios {
  constructor(private readonly pool: Pool) {}

  public async buscarPorNombreUsuario(nombreUsuario: string): Promise<Usuario | null> {
    const resultado = await this.pool.query<FilaUsuario>(
      `SELECT ${COLUMNAS_USUARIO}
       FROM usuarios
       WHERE LOWER(nombre_usuario) = LOWER($1)
       LIMIT 1`,
      [nombreUsuario],
    );

    if (resultado.rows.length === 0) return null;
    return mapearFilaAUsuario(resultado.rows[0]);
  }

  public async buscarPorId(id: string): Promise<Usuario | null> {
    const resultado = await this.pool.query<FilaUsuario>(
      `SELECT ${COLUMNAS_USUARIO}
       FROM usuarios
       WHERE id = $1
       LIMIT 1`,
      [id],
    );

    if (resultado.rows.length === 0) return null;
    return mapearFilaAUsuario(resultado.rows[0]);
  }

  public async crear(datos: CrearUsuarioDatos): Promise<Usuario> {
    const permisos = datos.permisosModulos ?? PERMISOS_POR_DEFECTO_ROL[datos.rol];
    const resultado = await this.pool.query<FilaUsuario>(
      `INSERT INTO usuarios (nombre_usuario, hash_contrasena, rol, permisos_modulos)
       VALUES ($1, $2, $3, $4::jsonb)
       RETURNING ${COLUMNAS_USUARIO}`,
      [datos.nombreUsuario, datos.hashContrasena, datos.rol, JSON.stringify(permisos)],
    );

    return mapearFilaAUsuario(resultado.rows[0]);
  }

  public async registrarIntentoInicioSesion(intento: IntentoInicioSesionDatos): Promise<void> {
    await this.pool.query(
      `INSERT INTO intentos_inicio_sesion (nombre_usuario, direccion_ip, exitoso)
       VALUES ($1, $2, $3)`,
      [intento.nombreUsuario, intento.direccionIp, intento.exitoso],
    );
  }

  public async contarUsuarios(): Promise<number> {
    const resultado = await this.pool.query<{ total: string }>(
      `SELECT COUNT(*)::text AS total FROM usuarios`,
    );
    return Number(resultado.rows[0]?.total ?? 0);
  }

  public async listarTodos(): Promise<Usuario[]> {
    const resultado = await this.pool.query<FilaUsuario>(
      `SELECT ${COLUMNAS_USUARIO}
       FROM usuarios
       ORDER BY creado_en ASC`,
    );
    return resultado.rows.map(mapearFilaAUsuario);
  }

  public async actualizarAcceso(id: string, direccionIp: string): Promise<void> {
    await this.pool.query(
      `UPDATE usuarios
       SET ultimo_acceso_en = NOW(), ultima_ip_acceso = $2
       WHERE id = $1`,
      [id, direccionIp.slice(0, 45)],
    );
  }

  public async actualizarPermisosYRol(
    id: string,
    rol: RolUsuario,
    permisosModulos: ModuloSistema[],
  ): Promise<Usuario | null> {
    const resultado = await this.pool.query<FilaUsuario>(
      `UPDATE usuarios
       SET rol = $2, permisos_modulos = $3::jsonb
       WHERE id = $1
       RETURNING ${COLUMNAS_USUARIO}`,
      [id, rol, JSON.stringify(permisosModulos)],
    );
    if (resultado.rows.length === 0) return null;
    return mapearFilaAUsuario(resultado.rows[0]);
  }

  public async actualizarEstadoActivo(id: string, activo: boolean): Promise<Usuario | null> {
    const resultado = await this.pool.query<FilaUsuario>(
      `UPDATE usuarios
       SET activo = $2,
           version_sesion = CASE WHEN $2 = FALSE THEN version_sesion + 1 ELSE version_sesion END
       WHERE id = $1
       RETURNING ${COLUMNAS_USUARIO}`,
      [id, activo],
    );
    if (resultado.rows.length === 0) return null;
    return mapearFilaAUsuario(resultado.rows[0]);
  }

  public async actualizarContrasenaYRevocarSesiones(
    id: string,
    hashContrasena: string,
  ): Promise<void> {
    await this.pool.query(
      `UPDATE usuarios
       SET hash_contrasena = $2, version_sesion = version_sesion + 1
       WHERE id = $1`,
      [id, hashContrasena],
    );
  }

  public async incrementarVersionSesion(id: string): Promise<void> {
    await this.pool.query(
      `UPDATE usuarios SET version_sesion = version_sesion + 1 WHERE id = $1`,
      [id],
    );
  }

  public async crearInvitacion(datos: CrearInvitacionDatos): Promise<InvitacionUsuario> {
    const resultado = await this.pool.query<FilaInvitacion>(
      `INSERT INTO invitaciones_usuario
         (token_hash, prefijo_token, rol, permisos_modulos, nota, creado_por_id, expira_en)
       VALUES ($1, $2, $3, $4::jsonb, $5, $6, $7)
       RETURNING id, prefijo_token, rol, permisos_modulos, nota, creado_por_id,
                 expira_en, usado_en, usado_por_id, revocada, creado_en`,
      [
        datos.tokenHash,
        datos.prefijoToken,
        datos.rol,
        JSON.stringify(datos.permisosModulos),
        datos.nota,
        datos.creadoPorId,
        datos.expiraEn,
      ],
    );
    return mapearFilaAInvitacion(resultado.rows[0]);
  }

  public async listarInvitaciones(): Promise<InvitacionUsuario[]> {
    const resultado = await this.pool.query<FilaInvitacion>(
      `SELECT i.id, i.prefijo_token, i.rol, i.permisos_modulos, i.nota, i.creado_por_id,
              i.expira_en, i.usado_en, i.usado_por_id, u.nombre_usuario AS usado_por_nombre,
              i.revocada, i.creado_en
       FROM invitaciones_usuario i
       LEFT JOIN usuarios u ON u.id = i.usado_por_id
       ORDER BY i.creado_en DESC
       LIMIT 50`,
    );
    return resultado.rows.map(mapearFilaAInvitacion);
  }

  public async buscarInvitacionPorHash(tokenHash: string): Promise<InvitacionUsuario | null> {
    const resultado = await this.pool.query<FilaInvitacion>(
      `SELECT id, prefijo_token, rol, permisos_modulos, nota, creado_por_id,
              expira_en, usado_en, usado_por_id, revocada, creado_en
       FROM invitaciones_usuario
       WHERE token_hash = $1
       LIMIT 1`,
      [tokenHash],
    );
    if (resultado.rows.length === 0) return null;
    return mapearFilaAInvitacion(resultado.rows[0]);
  }

  public async marcarInvitacionUsada(id: string, usadoPorId: string): Promise<void> {
    await this.pool.query(
      `UPDATE invitaciones_usuario
       SET usado_en = NOW(), usado_por_id = $2
       WHERE id = $1`,
      [id, usadoPorId],
    );
  }

  public async revocarInvitacion(id: string): Promise<boolean> {
    const resultado = await this.pool.query(
      `UPDATE invitaciones_usuario
       SET revocada = TRUE
       WHERE id = $1 AND usado_en IS NULL`,
      [id],
    );
    return (resultado.rowCount ?? 0) > 0;
  }

  public async obtenerPreferencia(clave: string): Promise<Record<string, unknown> | null> {
    const resultado = await this.pool.query<{ valor: Record<string, unknown> }>(
      `SELECT valor FROM preferencias_sistema WHERE clave = $1 LIMIT 1`,
      [clave],
    );
    return resultado.rows[0]?.valor ?? null;
  }

  public async guardarPreferencia(
    clave: string,
    valor: Record<string, unknown>,
  ): Promise<void> {
    await this.pool.query(
      `INSERT INTO preferencias_sistema (clave, valor, actualizado_en)
       VALUES ($1, $2::jsonb, NOW())
       ON CONFLICT (clave)
       DO UPDATE SET valor = EXCLUDED.valor, actualizado_en = NOW()`,
      [clave, JSON.stringify(valor)],
    );
  }
}
