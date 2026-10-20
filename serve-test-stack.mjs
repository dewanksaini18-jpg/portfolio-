// Starts the fake Supabase (:3200) and the real server (:3100) wired together, for browser tests.
//   node test/serve-test-stack.mjs
import { spawn } from 'node:child_process';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createMock, KEYS } from './mock-supabase.js';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const mock = createMock();
const mockPort = await mock.listen(Number(process.env.MOCK_PORT) || 3200);
const sitePort = Number(process.env.PORT) || 3100;

const child = spawn(process.execPath, ['server.js'], {
  cwd: ROOT,
  stdio: 'inherit',
  env: {
    ...process.env,
    PORT: String(sitePort),
    SUPABASE_URL: `http://127.0.0.1:${mockPort}`,
    SUPABASE_ANON_KEY: KEYS.anon,
    SUPABASE_SERVICE_ROLE_KEY: KEYS.service,
    SITE_URL: `http://127.0.0.1:${sitePort}`,
  },
});
console.log(`stack up: site http://127.0.0.1:${sitePort}  mock http://127.0.0.1:${mockPort}`);
process.on('SIGTERM', () => { child.kill(); process.exit(0); });
process.on('SIGINT', () => { child.kill(); process.exit(0); });
