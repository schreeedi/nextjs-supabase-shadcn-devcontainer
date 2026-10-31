// Structured logging: one JSON line per entry on stdout/stderr, so log
// collectors (Docker, Loki, Logflare, …) can parse it without a format.
// Framework-free — used by the app and by the background worker bundle.

export type LogLevel = "debug" | "info" | "warn" | "error";
export type LogFields = Record<string, unknown>;

const ORDER: Record<LogLevel, number> = {
  debug: 10,
  info: 20,
  warn: 30,
  error: 40,
};

// By key suffix, so `inputTokens` or `tokenCount` stay readable while
// `accessToken`, `api_key` or `password` are masked.
const SECRET_KEY = /(password|secret|token|api_?key|authorization|cookie)$/i;
const REDACTED = "[redacted]";

/**
 * No empty fields in log lines: undefined, null, "", [] and {} carry no
 * information and only bloat the line (and dashboards). 0 and false stay.
 */
function isEmpty(value: unknown): boolean {
  if (value === undefined || value === null || value === "") return true;
  if (Array.isArray(value)) return value.length === 0;
  if (typeof value === "object" && !(value instanceof Date)) {
    return Object.keys(value).length === 0;
  }
  return false;
}

/**
 * Deep copy of `value` with secret-looking keys masked, errors flattened and
 * empty fields dropped.
 */
export function redact(value: unknown, depth = 0): unknown {
  if (depth > 6) return "[depth]";
  if (value instanceof Error) {
    return redact(
      { name: value.name, message: value.message, stack: value.stack },
      depth,
    );
  }
  if (Array.isArray(value)) return value.map((v) => redact(v, depth + 1));
  if (value && typeof value === "object" && !(value instanceof Date)) {
    return Object.fromEntries(
      Object.entries(value)
        .map(([key, v]) => [
          key,
          SECRET_KEY.test(key) ? REDACTED : redact(v, depth + 1),
        ])
        .filter(([, v]) => !isEmpty(v)),
    );
  }
  return value;
}

/** Personal data stays out of messages: "ada@example.com" → "a…@example.com". */
export function maskEmails(text: string): string {
  return text.replace(
    /([A-Za-z0-9._%+-])[A-Za-z0-9._%+-]*@([A-Za-z0-9.-]+\.[A-Za-z]{2,})/g,
    "$1…@$2",
  );
}

export function parseLevel(raw: string | undefined): LogLevel {
  return raw && raw in ORDER ? (raw as LogLevel) : "info";
}

export type Logger = {
  [L in LogLevel]: (msg: string, fields?: LogFields) => void;
} & { child: (fields: LogFields) => Logger };

type LoggerOptions = {
  level?: LogLevel;
  /** Output sink — tests pass a spy. Default: stderr for warn/error, else stdout. */
  write?: (level: LogLevel, line: string) => void;
  now?: () => Date;
};

function defaultWrite(level: LogLevel, line: string) {
  if (level === "warn" || level === "error") console.error(line);
  else console.log(line);
}

/** Logger with fixed context fields (`service`, `userId`, `action`, …). */
export function createLogger(
  base: LogFields = {},
  {
    level = parseLevel(process.env.LOG_LEVEL),
    write = defaultWrite,
    now = () => new Date(),
  }: LoggerOptions = {},
): Logger {
  const emit = (lvl: LogLevel, msg: string, fields: LogFields = {}) => {
    if (ORDER[lvl] < ORDER[level]) return;
    const entry = redact({ ...base, ...fields }) as LogFields;
    write(
      lvl,
      JSON.stringify({
        level: lvl,
        time: now().toISOString(),
        msg: maskEmails(msg),
        ...entry,
      }),
    );
  };
  return {
    debug: (msg, fields) => emit("debug", msg, fields),
    info: (msg, fields) => emit("info", msg, fields),
    warn: (msg, fields) => emit("warn", msg, fields),
    error: (msg, fields) => emit("error", msg, fields),
    child: (fields) =>
      createLogger({ ...base, ...fields }, { level, write, now }),
  };
}
