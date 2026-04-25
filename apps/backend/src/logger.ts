import pino, { LoggerOptions } from 'pino';

export function createLogger(level: string, pretty: boolean): pino.Logger {
  const opts: LoggerOptions = { level };
  if (pretty) {
    opts.transport = {
      target: 'pino-pretty',
      options: { colorize: true, translateTime: 'SYS:HH:MM:ss.l', ignore: 'pid,hostname' },
    };
  }
  return pino(opts);
}
