import { nodeResolve } from '@rollup/plugin-node-resolve';
import commonjs from '@rollup/plugin-commonjs';

export default [
  {
    input: 'src/client/index.js',
    output: [
      {
        file: 'dist/bitsocket-client.js',
        format: 'iife',
        name: 'BitSocket'
      },
      {
        file: 'dist/bitsocket-client.esm.js',
        format: 'es'
      }
    ],
    plugins: [nodeResolve({ browser: true }), commonjs()]
  },
  {
    input: 'src/server/index.js',
    external: ['ws', 'http'],
    output: [
      {
        file: 'dist/bitsocket-server.cjs',
        format: 'cjs'
      },
      {
        file: 'dist/bitsocket-server.esm.js',
        format: 'es'
      }
    ],
    plugins: [nodeResolve({ preferBuiltins: true }), commonjs()]
  }
];
