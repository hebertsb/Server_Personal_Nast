import { Pool } from 'pg';
import { RolUsuario, Usuario } from '../../dominio/entidades/Usuario';
import {
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
  });
}

/** Implementación PostgreSQL de RepositorioUsuarios usando exclusivamente queries parametrizadas. */
export class RepositorioUsuariosPostgres implements RepositorioUsuarios {
  constructor(private readonly pool: Pool) {}

  public async buscarPorNombreUsuario(nombreUsuario: string): Promise<Usuario | null> {
    const resultado = await this.pool.query<FilaUsuario>(
      `SELECT id, nombre_usuario, hash_contrasena, rol, secreto_totp, totp_habilitado, creado_en
       FROM usuarios
       WHERE nombre_usuario = $1
       LIMIT 1`,
      [nombreUsuario],
    );

    if (resultado.rows.length === 0) {
      return null;
    }

    return mapearFilaAUsuario(resultado.rows[0]);
  }

  public async buscarPorId(id: string): Promise<Usuario | null> {
    const resultado = await this.pool.query<FilaUsuario>(
      `SELECT id, nombre_usuario, hash_contrasena, rol, secreto_totp, totp_habilitado, creado_en
       FROM usuarios
       WHERE id = $1
       LIMIT 1`,
      [id],
    );

    if (resultado.rows.length === 0) {
      return null;
    }

    return mapearFilaAUsuario(resultado.rows[0]);
  }

  public async crear(datos: CrearUsuarioDatos): Promise<Usuario> {
    const resultado = await this.pool.query<FilaUsuario>(
      `INSERT INTO usuarios (nombre_usuario, hash_contrasena, rol)
       VALUES ($1, $2, $3)
       RETURNING id, nombre_usuario, hash_contrasena, rol, secreto_totp, totp_habilitado, creado_en`,
      [datos.nombreUsuario, datos.hashContrasena, datos.rol],
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
}
