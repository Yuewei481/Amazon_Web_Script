import readline from 'node:readline/promises';
import { stdin as input, stdout as output } from 'node:process';

export async function waitForManualVerification(reason, logger) {
  logger.warn('Manual verification required', { reason });
  const rl = readline.createInterface({ input, output });
  try {
    await rl.question(`需要人工验证：${reason}\n请在浏览器完成验证后按 Enter 继续...`);
  } finally {
    rl.close();
  }
}
