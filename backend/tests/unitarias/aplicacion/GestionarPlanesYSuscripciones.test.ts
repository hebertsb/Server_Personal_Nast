import { describe, expect, it, vi } from 'vitest';
import { GestionarPlanesYSuscripciones } from '../../../src/aplicacion/planes/GestionarPlanesYSuscripciones';
import { RepositorioAuditoria } from '../../../src/dominio/interfaces/RepositorioAuditoria';
import { RepositorioPlanes } from '../../../src/dominio/interfaces/RepositorioPlanes';
import { RepositorioUsuarios } from '../../../src/dominio/interfaces/RepositorioUsuarios';

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
});
