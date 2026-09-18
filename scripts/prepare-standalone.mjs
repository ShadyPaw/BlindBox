import { cp, access } from 'node:fs/promises';

const name = process.argv[2];
if (!['web', 'admin'].includes(name)) throw new Error('Expected web or admin');
const app = new URL(`../apps/${name}/`, import.meta.url);
const output = new URL(`.next/standalone/apps/${name}/`, app);
await cp(new URL('.next/static/', app), new URL('.next/static/', output), {
  recursive: true,
});
try {
  await access(new URL('public/', app));
} catch (error) {
  if (error.code !== 'ENOENT') throw error;
  process.exit(0);
}
await cp(new URL('public/', app), new URL('public/', output), {
  recursive: true,
});
