// Provision the contest endpoints once. Operators supply MIRA_TOKEN separately.
import { mkdir, link, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { homedir } from 'node:os';
import { join } from 'node:path';

const directory = join(process.env.XDG_CONFIG_HOME || join(homedir(), '.config'), 'forewind');
await mkdir(directory, { recursive: true, mode: 0o700 });
const target = join(directory, 'hub.env');
const temp = await mkdtemp(join(directory, '.seed-'));
try {
  const staged = join(temp, 'hub.env');
  await writeFile(staged, [
    'MIRA_SUBMIT_URL=https://codegeex.dev/hub.submit.json',
    "MIRA_STATUS_URL='https://codegeex.dev/hub.status.{id}.json'",
    '',
  ].join('\n'), { mode: 0o600 });
  await link(staged, target);
  console.log('Created', target);
} catch (error) {
  if (error.code !== 'EEXIST') throw error;
  console.log('Keeping existing', target);
} finally {
  await rm(temp, { recursive: true, force: true });
}
