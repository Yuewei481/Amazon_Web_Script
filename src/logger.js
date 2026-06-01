import fs from 'node:fs';

export function createLogger(logPath) {
  const stream = fs.createWriteStream(logPath, { flags: 'a' });

  function write(level, message, meta) {
    const suffix = meta ? ` ${JSON.stringify(meta)}` : '';
    const line = `[${new Date().toISOString()}] ${level.toUpperCase()} ${message}${suffix}`;
    console.log(line);
    stream.write(`${line}\n`);
  }

  return {
    info: (message, meta) => write('info', message, meta),
    warn: (message, meta) => write('warn', message, meta),
    error: (message, meta) => write('error', message, meta),
    close: () => stream.end(),
  };
}
