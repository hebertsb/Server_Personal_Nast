import {
  PuntoHistoricoRecursos,
  RangoHistorico,
  RecursosHost,
} from '../entidades/RecursosHost';

export interface RepositorioRecursosHost {
  guardarSnapshot(recursos: RecursosHost): Promise<void>;
  obtenerHistorico(rango: RangoHistorico): Promise<PuntoHistoricoRecursos[]>;
}
