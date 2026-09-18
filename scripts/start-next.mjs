const name = process.argv[2];
if (!['web', 'admin'].includes(name)) throw new Error('Expected web or admin');
process.env.PORT ??= name === 'web' ? '3000' : '3001';
process.env.HOSTNAME ??= '0.0.0.0';
await import(
  new URL(
    `../apps/${name}/.next/standalone/apps/${name}/server.js`,
    import.meta.url,
  ).href
);
