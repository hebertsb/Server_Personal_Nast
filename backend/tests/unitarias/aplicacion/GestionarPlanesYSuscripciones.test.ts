import { describe, expect, it, vi } from 'vitest';
import { GestionarPlanesYSuscripciones } from '../../../src/aplicacion/planes/GestionarPlanesYSuscripciones';
import { RepositorioAuditoria } from '../../../src/dominio/interfaces/RepositorioAuditoria';
import { RepositorioPlanes } from '../../../src/dominio/interfaces/RepositorioPlanes';
import { RepositorioUsuarios } from '../../../src/dominio/interfaces/RepositorioUsuarios';
import { parsearTextoOcrQrBancario } from '../../../src/infraestructura/sistema/LectorOcrQrBancario';

describe('GestionarPlanesYSuscripciones', () => {
  it('calcula recomendación comercial en Bs según recursos e IA ligera', async () => {
    const repoPlanes = {} as RepositorioPlanes;
    const repoUsuarios = {} as RepositorioUsuarios;
    const auditoria: RepositorioAuditoria = { registrar: vi.fn(), listar: vi.fn() };

    const casoUso = new GestionarPlanesYSuscripciones(repoPlanes, repoUsuarios, auditoria);
    const rec = await casoUso.recomendarPlanConIA({
      nombre: 'Plan Pro',
      cuotaRamMb: 1024,
      cuotaCpu: 1,
      maxProyectos: 4,
      iaBasicaHabilitada: true,
    });

    expect(rec.precioSugeridoBs).toBeGreaterThanOrEqual(30);
    expect(rec.beneficiosSugeridos.length).toBeGreaterThanOrEqual(4);
    expect(rec.descripcionSugerida).toContain('1024 MB');
  });

  it('calcula correctamente el monto anual con descuento al crear solicitud', async () => {
    const crearSolicitud = vi.fn(async (datos) => ({
      id: 'sol-1',
      ...datos,
      estado: 'pendiente' as const,
      revisadoPor: '',
      creadoEn: new Date().toISOString(),
      actualizadoEn: new Date().toISOString(),
    }));
    const repoPlanes = {
      obtenerPlanPorId: vi.fn(async () => ({
        id: 'plan-pro',
        codigo: 'pro',
        nombre: 'Plan Full-Stack Pro',
        descripcion: 'Pro',
        precioBs: 35,
        descuentoAnualPct: 20,
        periodo: 'mes',
        cuotaRamMb: 1024,
        cuotaCpu: 1,
        maxProyectos: 4,
        maxMiembros: 5,
        iaBasicaHabilitada: true,
        beneficios: [],
        destacado: true,
        activo: true,
        orden: 2,
        creadoEn: new Date().toISOString(),
        actualizadoEn: new Date().toISOString(),
      })),
      crearSolicitud,
    } as unknown as RepositorioPlanes;

    const repoUsuarios = {} as RepositorioUsuarios;
    const auditoria: RepositorioAuditoria = { registrar: vi.fn(), listar: vi.fn() };
    const casoUso = new GestionarPlanesYSuscripciones(repoPlanes, repoUsuarios, auditoria);

    const sol = await casoUso.crearSolicitud(
      {
        planId: 'plan-pro',
        cicloFacturacion: 'anual',
        metodoPago: 'qr',
        referenciaPago: 'QR-999',
        notaCliente: 'Proyecto anual',
      },
      { usuarioId: 'u-1', nombreUsuario: 'alumno1', direccionIp: '127.0.0.1' },
    );

    expect(sol.cicloFacturacion).toBe('anual');
    expect(sol.montoBs).toBe(336); // 35 * 12 = 420, -20% = 336
    expect(crearSolicitud).toHaveBeenCalledWith(
      expect.objectContaining({ cicloFacturacion: 'anual', montoBs: 336 }),
    );
  });

  it('extrae banco, titular y cuenta de textos OCR de Banco Ganadero y BNB', () => {
    const ganadero = parsearTextoOcrQrBancario(
      'BANCO GANADERO\nBs 0.00\nSUAREZ BURGOS HEBERT\nCuenta de abono CA 1310369820\nPAGO SUSCRIPCIÓN\nVENCE EL 28 DE NOVIEMBRE, 2027',
    );
    expect(ganadero.banco).toBe('Banco Ganadero');
    expect(ganadero.titular).toBe('Suarez Burgos Hebert');
    expect(ganadero.numeroCuenta).toBe('1310369820');

    const bnb = parsearTextoOcrQrBancario(
      'BNB\nMonto: Bs. 0.00\nPagar a: Suarez Burgos Hebert\nCuenta destino: 2502339551\nConcepto: Sin especificar',
    );
    expect(bnb.banco).toBe('Banco Nacional de Bolivia (BNB)');
    expect(bnb.titular).toBe('Suarez Burgos Hebert');
    expect(bnb.numeroCuenta).toBe('2502339551');
  });
});
