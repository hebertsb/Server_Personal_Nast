import {
  ExplicacionFalloDespliegue,
  RespuestaConsultaIa,
  ResumenSeguridadIa,
} from '../../dominio/entidades/IaYMcp';
import {
  ContextoConsultaServidor,
  EntradaExplicarFallo,
  EntradaResumenSeguridad,
  ProveedorIA,
} from '../../dominio/interfaces/ProveedorIA';
import { ProveedorIADeterminista } from './ProveedorIADeterminista';

export interface ConfigProveedorIA {
  modo: 'auto' | 'nube' | 'ollama' | 'local';
  apiKey: string;
  ollamaUrl: string;
  modelo: string;
}

/**
 * Strategy híbrido (RF-56, RF-57, RF-58):
 * - Nube (Gemini API vía fetch nativo) si hay IA_API_KEY configurada.
 * - Ollama local si IA_PROVEEDOR=ollama.
 * - Fallback automático al analizador determinista si el proveedor externo falla o no hay clave.
 */
export class ProveedorIAHibrido implements ProveedorIA {
  public readonly nombre: string;
  private readonly respaldo = new ProveedorIADeterminista();

  constructor(private readonly config: ConfigProveedorIA) {
    if ((config.modo === 'nube' || config.modo === 'auto') && config.apiKey.length > 10) {
      this.nombre = `gemini:${config.modelo}`;
    } else if (config.modo === 'ollama' || (config.modo === 'auto' && config.ollamaUrl)) {
      this.nombre = `ollama:${config.modelo}`;
    } else {
      this.nombre = this.respaldo.nombre;
    }
  }

  private async invocarLlm(prompt: string): Promise<string | null> {
    try {
      if ((this.config.modo === 'nube' || this.config.modo === 'auto') && this.config.apiKey.length > 10) {
        const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(
          this.config.modelo,
        )}:generateContent?key=${encodeURIComponent(this.config.apiKey)}`;
        const r = await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [{ parts: [{ text: prompt }] }],
          }),
          signal: AbortSignal.timeout(8000),
        });
        if (!r.ok) return null;
        const json = (await r.json()) as {
          candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
        };
        return json.candidates?.[0]?.content?.parts?.[0]?.text?.trim() ?? null;
      }

      if (this.config.modo === 'ollama' || (this.config.modo === 'auto' && this.config.ollamaUrl)) {
        const r = await fetch(`${this.config.ollamaUrl.replace(/\/+$/, '')}/api/generate`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            model: this.config.modelo,
            prompt,
            stream: false,
            keep_alive: '10m',
            options: { num_predict: 180, temperature: 0.3 },
          }),
          signal: AbortSignal.timeout(45_000),
        });
        if (!r.ok) return null;
        const json = (await r.json()) as { response?: string };
        return json.response?.trim() ?? null;
      }
    } catch {
      return null;
    }
    return null;
  }

  public async explicarFalloDespliegue(
    entrada: EntradaExplicarFallo,
  ): Promise<ExplicacionFalloDespliegue> {
    const base = await this.respaldo.explicarFalloDespliegue(entrada);
    const textoLlm = await this.invocarLlm(
      `Eres el asistente técnico de HomeSOC. Explica brevemente en español por qué falló el despliegue de "${entrada.nombreProyecto}" (commit ${entrada.commitSha}, estado ${entrada.estado}) y qué hacer:\nLOG:\n${entrada.logConstruccion.slice(0, 1500)}`,
    );
    if (!textoLlm) return base;
    return {
      ...base,
      proveedor: this.nombre,
      causaProbable: textoLlm,
    };
  }

  public async generarResumenSeguridad(
    entrada: EntradaResumenSeguridad,
  ): Promise<ResumenSeguridadIa> {
    const base = await this.respaldo.generarResumenSeguridad(entrada);
    const textoLlm = await this.invocarLlm(
      `Resume en 2 frases claras en español la actividad de seguridad del homelab: ${JSON.stringify(entrada)}.`,
    );
    if (!textoLlm) return base;
    return {
      ...base,
      proveedor: this.nombre,
      resumenEjecutivo: textoLlm,
    };
  }

  public async responderConsulta(
    pregunta: string,
    contexto: ContextoConsultaServidor,
  ): Promise<RespuestaConsultaIa> {
    const base = await this.respaldo.responderConsulta(pregunta, contexto);
    const textoLlm = await this.invocarLlm(
      `Eres el asistente de voz de HomeSOC. Responde en español conciso (máx 2 frases, apto para leerse en voz alta) a: "${pregunta}". Estado real del servidor: ${JSON.stringify(contexto)}.`,
    );
    if (!textoLlm) return base;
    return {
      proveedor: this.nombre,
      respuesta: textoLlm,
      textoParaVoz: textoLlm.replace(/[*_`#]/g, ''),
      generadoEn: new Date().toISOString(),
    };
  }
}
