const esbuild = require('esbuild');

esbuild.build({
  entryPoints: ['src/index.ts'],
  bundle: true,
  format: 'esm',
  platform: 'browser',
  target: 'es2020',
  outfile: 'dist/browser/index.js',
  sourcemap: true,
  external: ['ws'], // Exclude Node.js ws module
  define: {
    'process.env.NODE_ENV': '"production"'
  },
  banner: {
    js: '// MAVLinkBridge API Client - Browser Bundle'
  }
}).catch(() => process.exit(1));
