import { env } from "./env";

type Level = "debug" | "info" | "warn" | "error";
const ORDER: Record<Level, number> = { debug: 10, info: 20, warn: 30, error: 40 };

const threshold = ORDER[(env.logLevel as Level) in ORDER ? (env.logLevel as Level) : "info"];

function emit(level: Level, msg: string, meta?: Record<string, unknown>) {
  if (ORDER[level] < threshold) return;
  const line = {
    t: new Date().toISOString(),
    level,
    msg,
    ...(meta ?? {}),
  };
  const out = env.isProd ? JSON.stringify(line) : `[${level.toUpperCase()}] ${msg}` + (meta ? ` ${JSON.stringify(meta)}` : "");
  if (level === "error") console.error(out);
  else if (level === "warn") console.warn(out);
  else console.log(out);
}

export const logger = {
  debug: (msg: string, meta?: Record<string, unknown>) => emit("debug", msg, meta),
  info: (msg: string, meta?: Record<string, unknown>) => emit("info", msg, meta),
  warn: (msg: string, meta?: Record<string, unknown>) => emit("warn", msg, meta),
  error: (msg: string, meta?: Record<string, unknown>) => emit("error", msg, meta),
  child: (scope: string) => ({
    debug: (m: string, meta?: Record<string, unknown>) => emit("debug", `[${scope}] ${m}`, meta),
    info: (m: string, meta?: Record<string, unknown>) => emit("info", `[${scope}] ${m}`, meta),
    warn: (m: string, meta?: Record<string, unknown>) => emit("warn", `[${scope}] ${m}`, meta),
    error: (m: string, meta?: Record<string, unknown>) => emit("error", `[${scope}] ${m}`, meta),
  }),
};
