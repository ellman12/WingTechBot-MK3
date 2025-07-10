#!/usr/bin/env node
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const SRC_DIR = path.join(__dirname, '../src');
const PACKAGE_JSON_PATH = path.join(__dirname, '../package.json');

/**
 * Recursively find all TypeScript files in a directory
 */
function findTsFiles(dir, baseDir = dir) {
  const files = [];
  const entries = fs.readdirSync(dir, { withFileTypes: true });

  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    const relativePath = path.relative(baseDir, fullPath);

    if (entry.isDirectory()) {
      files.push(...findTsFiles(fullPath, baseDir));
    } else if (entry.name.endsWith('.ts') && !entry.name.endsWith('.d.ts')) {
      // Convert file path to module path (remove .ts extension, use forward slashes)
      const modulePath = relativePath.replace(/\.ts$/, '').replace(/\\/g, '/');
      files.push(modulePath);
    }
  }

  return files;
}

/**
 * Generate exports object for package.json
 */
function generateExports(tsFiles) {
  const exports = {
    '.': {
      types: './dist/index.d.ts',
      import: './dist/index.js',
    },
  };

  for (const file of tsFiles) {
    // Skip index files as they're handled by the main export
    if (file === 'index') continue;

    const modulePath = `./${file}`;
    exports[modulePath] = {
      types: `./dist/${file}.d.ts`,
      import: `./dist/${file}.js`,
    };
  }

  return exports;
}

/**
 * Update package.json with generated exports
 */
function updatePackageJson(exports) {
  const packageJson = JSON.parse(fs.readFileSync(PACKAGE_JSON_PATH, 'utf8'));

  // Update exports field
  packageJson.exports = exports;

  // Write back to file with proper formatting
  fs.writeFileSync(PACKAGE_JSON_PATH, JSON.stringify(packageJson, null, 2) + '\n');

  console.log('✅ Updated package.json exports field');
  console.log('📦 Generated exports for', Object.keys(exports).length, 'modules');
}

/**
 * Main function
 */
function main() {
  try {
    console.log('🔍 Scanning TypeScript files...');
    const tsFiles = findTsFiles(SRC_DIR);

    console.log('📝 Found TypeScript files:', tsFiles.length);
    tsFiles.forEach(file => console.log(`  - ${file}`));

    console.log('⚙️  Generating exports...');
    const exports = generateExports(tsFiles);

    console.log('💾 Updating package.json...');
    updatePackageJson(exports);

    console.log('🎉 Export generation complete!');
  } catch (error) {
    console.error('❌ Error generating exports:', error.message);
    process.exit(1);
  }
}

main();
