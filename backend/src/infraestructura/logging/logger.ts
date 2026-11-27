import pino, { Logger } from 'pino';

export function crearLogger(nivel: string): Logger {
  return pino({
    level: nivel,
    redact: {
      paths: [
        'req.headers.authorization',
        'req.headers.cookie',
        '*.contrasena',
        '*.password',
        '*.tokenRefresh',
        '*.hashContrasena',
      ],
      censor: '[REDACTADO]',
    },
  });
}
