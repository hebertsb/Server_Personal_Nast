import { Pool } from 'pg';
import {
  ComponentePortafolio,
  EstadoComponentePortafolio,
  EstadoProyectoPortafolio,
  EstadoTareaPortafolio,
  PrioridadTareaPortafolio,
  ProyectoPortafolio,
  TareaPortafolio,
  TipoComponentePortafolio,
} from '../../dominio/entidades/Portafolio';
import { RepositorioPortafolio } from '../../dominio/interfaces/RepositorioPortafolio';

interface FilaProyecto {
  id: string;
  nombre: string;
  descripcion: string;
  prefijo_contenedor: string;
  estado: EstadoProyectoPortafolio;
  repositorio_url: string;
  creado_por: string;
  creado_en: Date | string;
  actualizado_en: Date | string;
}

interface FilaComponente {
  id: string;
  proyecto_id: string;
  tipo: TipoComponentePortafolio;
  nombre: string;
  url: string;
  contenedor_nombre: string;
  estado_manual: EstadoComponentePortafolio;
  responsable: string;
  actualizado_en: Date | string;
}

interface FilaTarea {
  id: string;
  proyecto_id: string;
  titulo: string;
  estado: EstadoTareaPortafolio;
  prioridad: PrioridadTareaPortafolio;
  asignado_a: string;
  actualizado_por: string;
  creado_en: Date | string;
  actualizado_en: Date | string;
}

function aIso(v: Date | string): string {
  return v instanceof Date ? v.toISOString() : new Date(v).toISOString();
}

function mapProyecto(f: FilaProyecto): ProyectoPortafolio {
  return {
    id: f.id,
    nombre: f.nombre,
    descripcion: f.descripcion,
    prefijoContenedor: f.prefijo_contenedor,
    estado: f.estado,
    repositorioUrl: f.repositorio_url,
    creadoPor: f.creado_por,
    creadoEn: aIso(f.creado_en),
    actualizadoEn: aIso(f.actualizado_en),
  };
}

function mapComponente(f: FilaComponente): ComponentePortafolio {
  return {
    id: f.id,
    proyectoId: f.proyecto_id,
    tipo: f.tipo,
    nombre: f.nombre,
    url: f.url,
    contenedorNombre: f.contenedor_nombre,
    estadoManual: f.estado_manual,
    responsable: f.responsable,
    actualizadoEn: aIso(f.actualizado_en),
  };
}

function mapTarea(f: FilaTarea): TareaPortafolio {
  return {
    id: f.id,
    proyectoId: f.proyecto_id,
    titulo: f.titulo,
    estado: f.estado,
    prioridad: f.prioridad,
    asignadoA: f.asignado_a,
    actualizadoPor: f.actualizado_por,
    creadoEn: aIso(f.creado_en),
    actualizadoEn: aIso(f.actualizado_en),
  };
}

export class RepositorioPortafolioPostgres implements RepositorioPortafolio {
  constructor(private readonly pool: Pool) {}

  public async listarProyectos(): Promise<ProyectoPortafolio[]> {
    const res = await this.pool.query<FilaProyecto>(
      `SELECT id, nombre, descripcion, prefijo_contenedor, estado, repositorio_url, creado_por, creado_en, actualizado_en
       FROM portafolio_proyectos
       ORDER BY actualizado_en DESC, nombre ASC`,
    );
    return res.rows.map(mapProyecto);
  }

  public async obtenerProyectoPorId(id: string): Promise<ProyectoPortafolio | null> {
    const res = await this.pool.query<FilaProyecto>(
      `SELECT id, nombre, descripcion, prefijo_contenedor, estado, repositorio_url, creado_por, creado_en, actualizado_en
       FROM portafolio_proyectos
       WHERE id = $1`,
      [id],
    );
    return res.rows[0] ? mapProyecto(res.rows[0]) : null;
  }

  public async crearProyecto(datos: {
    nombre: string;
    descripcion: string;
    prefijoContenedor: string;
    estado: EstadoProyectoPortafolio;
    repositorioUrl: string;
    creadoPor: string;
  }): Promise<ProyectoPortafolio> {
    const res = await this.pool.query<FilaProyecto>(
      `INSERT INTO portafolio_proyectos
         (nombre, descripcion, prefijo_contenedor, estado, repositorio_url, creado_por)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING id, nombre, descripcion, prefijo_contenedor, estado, repositorio_url, creado_por, creado_en, actualizado_en`,
      [
        datos.nombre,
        datos.descripcion,
        datos.prefijoContenedor,
        datos.estado,
        datos.repositorioUrl,
        datos.creadoPor,
      ],
    );
    return mapProyecto(res.rows[0]);
  }

  public async actualizarProyecto(
    id: string,
    datos: {
      nombre?: string;
      descripcion?: string;
      prefijoContenedor?: string;
      estado?: EstadoProyectoPortafolio;
      repositorioUrl?: string;
    },
  ): Promise<ProyectoPortafolio | null> {
    const actual = await this.obtenerProyectoPorId(id);
    if (!actual) return null;
    const res = await this.pool.query<FilaProyecto>(
      `UPDATE portafolio_proyectos
       SET nombre = $2,
           descripcion = $3,
           prefijo_contenedor = $4,
           estado = $5,
           repositorio_url = $6,
           actualizado_en = NOW()
       WHERE id = $1
       RETURNING id, nombre, descripcion, prefijo_contenedor, estado, repositorio_url, creado_por, creado_en, actualizado_en`,
      [
        id,
        datos.nombre ?? actual.nombre,
        datos.descripcion ?? actual.descripcion,
        datos.prefijoContenedor ?? actual.prefijoContenedor,
        datos.estado ?? actual.estado,
        datos.repositorioUrl ?? actual.repositorioUrl,
      ],
    );
    return res.rows[0] ? mapProyecto(res.rows[0]) : null;
  }

  public async eliminarProyecto(id: string): Promise<boolean> {
    const res = await this.pool.query(`DELETE FROM portafolio_proyectos WHERE id = $1`, [id]);
    return (res.rowCount ?? 0) > 0;
  }

  public async listarComponentes(): Promise<ComponentePortafolio[]> {
    const res = await this.pool.query<FilaComponente>(
      `SELECT id, proyecto_id, tipo, nombre, url, contenedor_nombre, estado_manual, responsable, actualizado_en
       FROM portafolio_componentes
       ORDER BY tipo ASC, nombre ASC`,
    );
    return res.rows.map(mapComponente);
  }

  public async crearComponente(datos: {
    proyectoId: string;
    tipo: TipoComponentePortafolio;
    nombre: string;
    url: string;
    contenedorNombre: string;
    estadoManual: EstadoComponentePortafolio;
    responsable: string;
  }): Promise<ComponentePortafolio> {
    const res = await this.pool.query<FilaComponente>(
      `INSERT INTO portafolio_componentes
         (proyecto_id, tipo, nombre, url, contenedor_nombre, estado_manual, responsable)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING id, proyecto_id, tipo, nombre, url, contenedor_nombre, estado_manual, responsable, actualizado_en`,
      [
        datos.proyectoId,
        datos.tipo,
        datos.nombre,
        datos.url,
        datos.contenedorNombre,
        datos.estadoManual,
        datos.responsable,
      ],
    );
    await this.pool.query(
      `UPDATE portafolio_proyectos SET actualizado_en = NOW() WHERE id = $1`,
      [datos.proyectoId],
    );
    return mapComponente(res.rows[0]);
  }

  public async actualizarComponente(
    id: string,
    datos: {
      nombre?: string;
      url?: string;
      contenedorNombre?: string;
      estadoManual?: EstadoComponentePortafolio;
      responsable?: string;
    },
  ): Promise<ComponentePortafolio | null> {
    const prevRes = await this.pool.query<FilaComponente>(
      `SELECT id, proyecto_id, tipo, nombre, url, contenedor_nombre, estado_manual, responsable, actualizado_en
       FROM portafolio_componentes WHERE id = $1`,
      [id],
    );
    if (!prevRes.rows[0]) return null;
    const actual = mapComponente(prevRes.rows[0]);

    const res = await this.pool.query<FilaComponente>(
      `UPDATE portafolio_componentes
       SET nombre = $2,
           url = $3,
           contenedor_nombre = $4,
           estado_manual = $5,
           responsable = $6,
           actualizado_en = NOW()
       WHERE id = $1
       RETURNING id, proyecto_id, tipo, nombre, url, contenedor_nombre, estado_manual, responsable, actualizado_en`,
      [
        id,
        datos.nombre ?? actual.nombre,
        datos.url ?? actual.url,
        datos.contenedorNombre ?? actual.contenedorNombre,
        datos.estadoManual ?? actual.estadoManual,
        datos.responsable ?? actual.responsable,
      ],
    );
    await this.pool.query(
      `UPDATE portafolio_proyectos SET actualizado_en = NOW() WHERE id = $1`,
      [actual.proyectoId],
    );
    return res.rows[0] ? mapComponente(res.rows[0]) : null;
  }

  public async eliminarComponente(id: string): Promise<boolean> {
    const res = await this.pool.query(`DELETE FROM portafolio_componentes WHERE id = $1`, [id]);
    return (res.rowCount ?? 0) > 0;
  }

  public async listarTareas(): Promise<TareaPortafolio[]> {
    const res = await this.pool.query<FilaTarea>(
      `SELECT id, proyecto_id, titulo, estado, prioridad, asignado_a, actualizado_por, creado_en, actualizado_en
       FROM portafolio_tareas
       ORDER BY
         CASE estado WHEN 'en_progreso' THEN 1 WHEN 'pendiente' THEN 2 ELSE 3 END,
         CASE prioridad WHEN 'alta' THEN 1 WHEN 'media' THEN 2 ELSE 3 END,
         actualizado_en DESC`,
    );
    return res.rows.map(mapTarea);
  }

  public async crearTarea(datos: {
    proyectoId: string;
    titulo: string;
    prioridad: PrioridadTareaPortafolio;
    asignadoA: string;
    actualizadoPor: string;
  }): Promise<TareaPortafolio> {
    const res = await this.pool.query<FilaTarea>(
      `INSERT INTO portafolio_tareas
         (proyecto_id, titulo, prioridad, asignado_a, actualizado_por)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING id, proyecto_id, titulo, estado, prioridad, asignado_a, actualizado_por, creado_en, actualizado_en`,
      [datos.proyectoId, datos.titulo, datos.prioridad, datos.asignadoA, datos.actualizadoPor],
    );
    await this.pool.query(
      `UPDATE portafolio_proyectos SET actualizado_en = NOW() WHERE id = $1`,
      [datos.proyectoId],
    );
    return mapTarea(res.rows[0]);
  }

  public async actualizarTarea(
    id: string,
    datos: {
      titulo?: string;
      estado?: EstadoTareaPortafolio;
      prioridad?: PrioridadTareaPortafolio;
      asignadoA?: string;
      actualizadoPor: string;
    },
  ): Promise<TareaPortafolio | null> {
    const prevRes = await this.pool.query<FilaTarea>(
      `SELECT id, proyecto_id, titulo, estado, prioridad, asignado_a, actualizado_por, creado_en, actualizado_en
       FROM portafolio_tareas WHERE id = $1`,
      [id],
    );
    if (!prevRes.rows[0]) return null;
    const actual = mapTarea(prevRes.rows[0]);

    const res = await this.pool.query<FilaTarea>(
      `UPDATE portafolio_tareas
       SET titulo = $2,
           estado = $3,
           prioridad = $4,
           asignado_a = $5,
           actualizado_por = $6,
           actualizado_en = NOW()
       WHERE id = $1
       RETURNING id, proyecto_id, titulo, estado, prioridad, asignado_a, actualizado_por, creado_en, actualizado_en`,
      [
        id,
        datos.titulo ?? actual.titulo,
        datos.estado ?? actual.estado,
        datos.prioridad ?? actual.prioridad,
        datos.asignadoA ?? actual.asignadoA,
        datos.actualizadoPor,
      ],
    );
    await this.pool.query(
      `UPDATE portafolio_proyectos SET actualizado_en = NOW() WHERE id = $1`,
      [actual.proyectoId],
    );
    return res.rows[0] ? mapTarea(res.rows[0]) : null;
  }

  public async eliminarTarea(id: string): Promise<boolean> {
    const res = await this.pool.query(`DELETE FROM portafolio_tareas WHERE id = $1`, [id]);
    return (res.rowCount ?? 0) > 0;
  }
}
