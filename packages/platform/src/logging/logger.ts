import { pino } from "pino";

export const LOG_LEVELS = ["fatal", "error", "warn", "info", "debug", "trace", "silent"] as const;

export type LogLevel = (typeof LOG_LEVELS)[number];

/** Campi strutturati: valori serializzabili, nessun oggetto di dominio. */
export type LogFields = Record<string, unknown>;

/**
 * Porta minima di logging.
 *
 * I chiamanti passano campi espliciti e un messaggio; il formato e la
 * destinazione restano responsabilità dell'adapter. Tenerla stretta evita che
 * `pino` entri nelle firme dei moduli di dominio.
 */
export type Logger = {
  fatal: (fields: LogFields, message: string) => void;
  error: (fields: LogFields, message: string) => void;
  warn: (fields: LogFields, message: string) => void;
  info: (fields: LogFields, message: string) => void;
  debug: (fields: LogFields, message: string) => void;
  child: (bindings: LogFields) => Logger;
};

type CreateLoggerOptions = {
  level: LogLevel;
  service: string;
  pretty?: boolean;
};

/**
 * Log JSON su stdout, il formato che Docker e journald raccolgono senza
 * configurazione. `pretty` è riservato allo sviluppo locale e carica
 * `pino-pretty` solo lì.
 */
export function createLogger({ level, service, pretty = false }: CreateLoggerOptions): Logger {
  return pino({
    level,
    base: { service },
    redact: {
      paths: ["req.headers.authorization", "req.headers.cookie"],
      censor: "[redacted]",
    },
    ...(pretty
      ? {
          transport: {
            target: "pino-pretty",
            options: {
              colorize: true,
              translateTime: "SYS:standard",
              ignore: "pid,hostname",
            },
          },
        }
      : {}),
  });
}
