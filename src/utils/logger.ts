/**
 * Structured logging for auth and key app events.
 * All logs include a timestamp and context label.
 */

export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

interface LogEntry {
  timestamp: string;
  level: LogLevel;
  context: string;
  message: string;
  data?: unknown;
}

const logs: LogEntry[] = [];
const MAX_LOGS = 500;

function formatTimestamp(): string {
  return new Date().toISOString();
}

function addLog(level: LogLevel, context: string, message: string, data?: unknown): void {
  const entry: LogEntry = {
    timestamp: formatTimestamp(),
    level,
    context,
    message,
    ...(data !== undefined && { data }),
  };

  logs.push(entry);
  if (logs.length > MAX_LOGS) logs.shift();

  const prefix = `[${entry.timestamp}] [${context}]`;
  const logFn = console[level] || console.log;
  logFn(prefix, message, data !== undefined ? data : '');
}

export const logger = {
  debug: (context: string, message: string, data?: unknown) => addLog('debug', context, message, data),
  info: (context: string, message: string, data?: unknown) => addLog('info', context, message, data),
  warn: (context: string, message: string, data?: unknown) => addLog('warn', context, message, data),
  error: (context: string, message: string, data?: unknown) => addLog('error', context, message, data),
  getAllLogs: () => [...logs],
  clearLogs: () => logs.splice(0),
};
