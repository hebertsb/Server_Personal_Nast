import { describe, expect, it, vi } from 'vitest';
import { ListarContenedores } from '../../../src/aplicacion/contenedores/ListarContenedores';
import { GestionarProyectosDespliegue } from '../../../src/aplicacion/despliegues/GestionarProyectosDespliegue';
import { AsistenteIA } from '../../../src/aplicacion/ia/AsistenteIA';
import { EjecutorHerramientasMcp } from '../../../src/aplicacion/mcp/EjecutorHerramientasMcp';
import { GestionarTokensMcp } from '../../../src/aplicacion/mcp/GestionarTokensMcp';
import { ObtenerRecursosHost } from '../../../src/aplicacion/recursos/ObtenerRecursosHost';
import { ConsultarSeguridad } from '../../../src/aplicacion/seguridad/ConsultarSeguridad';
import { TokenMcpPersistido } from '../../../src/dominio/entidades/IaYMcp';
import { RepositorioAuditoria } from '../../../src/dominio/interfaces/RepositorioAuditoria';
import { RepositorioTokensMcp } from '../../../src/dominio/interfaces/RepositorioTokensMcp';
import { ProveedorIADeterminista } from '../../../src/infraestructura/ia/ProveedorIADeterminista';

describe('Fase 5 — Módulo de IA (Strategy) y Servidor MCP con permisos acotados', () => {
  it('explica fallos de Gate/HealthCheck y genera resumen diario sin depender de servicios externos', async () => {
    const proveedor = new ProveedorIADeterminista();
    const exp = await proveedor.explicarFalloDespliegue({
      nombreProyecto: 'landing-node',
      commitSha: 'sec7777',
      estado: 'pendiente_aprobacion',
      logConstruccion: '[Gate:gitleaks] CRITICO — Posible secreto detectado',
      logHealthCheck: '',
    });
    expect(exp.causaProbable).toContain('gitleaks');
    expect(exp.accionesSugeridas.length).toBeGreaterThan(0);

    const resumen = await proveedor.generarResumenSeguridad({
      totalEventos24h: 8,
      eventosCriticosOAltos: 2,
      ipsBloqueadas: 1,
      intentosSshFallidos: 6,
      tiposFrecuentes: ['fuerza_bruta_ssh'],
    });
    expect(resumen.nivelRiesgo).toBe('medio');
    expect(resumen.resumenEjecutivo).toContain('2');
  });

  it('separa permisos lectura/escritura en MCP y audita invocaciones con origen=mcp', async () => {
    const tokensGuardados: TokenMcpPersistido[] = [];
    const repoTokens: RepositorioTokensMcp = {
      crear: vi.fn().mockImplementation(async (d) => {
        const t: TokenMcpPersistido = {
          id: `t-${tokensGuardados.length + 1}`,
          ...d,
          ultimoUsoEn: null,
          revocado: false,
          creadoEn: '2026-11-27T00:00:00.000Z',
        };
        tokensGuardados.push(t);
        return t;
      }),
      listar: vi.fn().mockResolvedValue(tokensGuardados),
      buscarActivoPorHash: vi.fn().mockImplementation(async (h) =>
        tokensGuardados.find((t) => t.tokenHash === h && !t.revocado) ?? null,
      ),
      registrarUso: vi.fn().mockResolvedValue(undefined),
      revocar: vi.fn().mockResolvedValue(true),
    };
    const auditoria: RepositorioAuditoria = { registrar: vi.fn().mockResolvedValue(undefined) };

    const gestionarTokens = new GestionarTokensMcp(repoTokens, auditoria);
    const { tokenPlano: tkLectura } = await gestionarTokens.crearToken('Nova Lectura', 'lectura', {
      usuarioId: 'u1',
      rol: 'administrador',
      direccionIp: '127.0.0.1',
    });
    const { tokenPlano: tkEscritura } = await gestionarTokens.crearToken(
      'Nova Escritura',
      'escritura',
      { usuarioId: 'u1', rol: 'administrador', direccionIp: '127.0.0.1' },
    );

    const validadoLectura = await gestionarTokens.validarToken(tkLectura);
    const validadoEscritura = await gestionarTokens.validarToken(tkEscritura);
    expect(validadoLectura?.permiso).toBe('lectura');
    expect(validadoEscritura?.permiso).toBe('escritura');

    const proyectosMock = {
      listarProyectos: vi.fn().mockResolvedValue([]),
      ejecutarDespliegue: vi.fn().mockResolvedValue({ id: 'd1', estado: 'exitoso' }),
    } as unknown as GestionarProyectosDespliegue;

    const ejecutor = new EjecutorHerramientasMcp(
      { ejecutar: vi.fn() } as unknown as ObtenerRecursosHost,
      { ejecutar: vi.fn() } as unknown as ListarContenedores,
      { listarEventos: vi.fn() } as unknown as ConsultarSeguridad,
      proyectosMock,
      {
        generarResumenDiarioSeguridad: vi.fn(),
        consultarAsistente: vi.fn().mockResolvedValue({ respuesta: 'Todo OK', textoParaVoz: 'Todo OK' }),
      } as unknown as AsistenteIA,
      auditoria,
    );

    // Token lectura NO puede hacer redeploy
    await expect(
      ejecutor.ejecutar('redeploy_proyecto', { proyectoId: 'p1' }, validadoLectura!, '127.0.0.1'),
    ).rejects.toMatchObject({ codigo: 'PERMISOS_INSUFICIENTES' });

    // Token lectura SÍ puede consultar asistente de voz
    const respVoz = await ejecutor.ejecutar(
      'consultar_asistente_voz',
      { pregunta: '¿Cómo está el servidor?' },
      validadoLectura!,
      '127.0.0.1',
    );
    expect(JSON.stringify(respVoz)).toContain('Todo OK');

    // Token escritura SÍ puede hacer redeploy con origen='mcp'
    await ejecutor.ejecutar(
      'redeploy_proyecto',
      { proyectoId: 'p1' },
      validadoEscritura!,
      '127.0.0.1',
    );
    expect(proyectosMock.ejecutarDespliegue).toHaveBeenCalledWith(
      'p1',
      expect.objectContaining({ usuarioId: 'u1' }),
      'mcp',
    );
    expect(auditoria.registrar).toHaveBeenCalledWith(
      expect.objectContaining({ origen: 'mcp', accion: 'mcp_redeploy_proyecto' }),
    );
  });
});
