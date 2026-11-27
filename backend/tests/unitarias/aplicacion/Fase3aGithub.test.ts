import { describe, expect, it, vi } from 'vitest';
import { GestionarConexionGithub } from '../../../src/aplicacion/despliegues/GestionarConexionGithub';
import { ClienteGithub } from '../../../src/dominio/interfaces/ClienteGithub';
import { RepositorioAuditoria } from '../../../src/dominio/interfaces/RepositorioAuditoria';
import { RepositorioConexionGithub } from '../../../src/dominio/interfaces/RepositorioConexionGithub';
import { ServicioCifrado } from '../../../src/dominio/interfaces/ServicioCifrado';

function crearEscenario() {
  const cliente: ClienteGithub = {
    modo: 'simulacion',
    validarToken: vi.fn().mockResolvedValue({ usuario: 'hebert', alcances: 'repo' }),
    listarRepositorios: vi.fn().mockResolvedValue([]),
    listarArchivosRaiz: vi.fn().mockResolvedValue([]),
  };
  const guardado: { tokenCifrado?: string } = {};
  const repo: RepositorioConexionGithub = {
    guardar: vi.fn().mockImplementation(async (d) => {
      guardado.tokenCifrado = d.tokenCifrado;
      return { ...d, conectadoEn: 'x', actualizadoEn: 'x' };
    }),
    obtenerPorUsuario: vi.fn().mockImplementation(async () =>
      guardado.tokenCifrado
        ? {
            usuarioId: 'u1',
            usuarioGithub: 'hebert',
            tokenCifrado: guardado.tokenCifrado,
            alcances: 'repo',
            modo: 'simulacion',
            conectadoEn: 'x',
            actualizadoEn: 'x',
          }
        : null,
    ),
    eliminar: vi.fn().mockResolvedValue(true),
  };
  const cifrado: ServicioCifrado = {
    cifrar: (t) => `cifrado(${t})`,
    descifrar: (t) => t.replace(/^cifrado\((.*)\)$/, '$1'),
  };
  const auditoria: RepositorioAuditoria = { registrar: vi.fn().mockResolvedValue(undefined) };
  const casoUso = new GestionarConexionGithub(cliente, repo, cifrado, auditoria);
  return { casoUso, cliente, repo, auditoria, guardado };
}

const admin = { usuarioId: 'u1', rol: 'administrador' as const, direccionIp: '127.0.0.1' };

describe('Fase 3a — Conexión con GitHub (RF-28, RF-29)', () => {
  it('guarda el token cifrado, audita y nunca devuelve el token', async () => {
    const { casoUso, repo, auditoria } = crearEscenario();

    const vista = await casoUso.conectar('ghp_tokenDePrueba1234567890', admin);

    expect(repo.guardar).toHaveBeenCalledWith(
      expect.objectContaining({ tokenCifrado: 'cifrado(ghp_tokenDePrueba1234567890)' }),
    );
    expect(JSON.stringify(vista)).not.toContain('ghp_');
    expect(vista.usuarioGithub).toBe('hebert');
    expect(auditoria.registrar).toHaveBeenCalledWith(
      expect.objectContaining({ accion: 'github_conectar' }),
    );
  });

  it('descifra el token al listar repositorios y exige estar conectado', async () => {
    const { casoUso, cliente } = crearEscenario();

    await expect(casoUso.listarRepositorios(admin)).rejects.toMatchObject({
      codigo: 'GITHUB_NO_CONECTADO',
    });

    await casoUso.conectar('ghp_tokenDePrueba1234567890', admin);
    await casoUso.listarRepositorios(admin);
    expect(cliente.listarRepositorios).toHaveBeenCalledWith('ghp_tokenDePrueba1234567890');
  });

  it('rechaza conectar o desconectar a quien no es administrador', async () => {
    const { casoUso, cliente } = crearEscenario();
    const lector = { ...admin, rol: 'solo_lectura' as const };

    await expect(casoUso.conectar('ghp_tokenDePrueba1234567890', lector)).rejects.toMatchObject({
      codigo: 'PERMISOS_INSUFICIENTES',
    });
    expect(cliente.validarToken).not.toHaveBeenCalled();
    await expect(casoUso.desconectar(lector)).rejects.toMatchObject({
      codigo: 'PERMISOS_INSUFICIENTES',
    });
  });
});
