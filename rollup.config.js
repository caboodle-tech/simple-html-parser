import { readFileSync } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import terser from '@rollup/plugin-terser';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const pkg = JSON.parse(readFileSync(path.join(__dirname, 'package.json'), 'utf8'));

const license = `/**
 * simple-html-parser v${pkg.version} Copyright (c) ${new Date().getFullYear()} Caboodle Tech
 * License and source: https://github.com/caboodle-tech/simple-html-parser
 */`;

export default {
  input: 'src/simple-html-parser.js',
  output: {
    file: 'dist/simple-html-parser.min.js',
    format: 'esm'
  },
  plugins: [
    terser({
      format: {
        comments: false,
        preamble: license
      }
    })
  ]
};
