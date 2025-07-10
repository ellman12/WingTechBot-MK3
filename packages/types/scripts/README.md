# Export Generation Script

This script automatically generates the `exports` field in `package.json` based on the TypeScript source files in the `src` directory.

## How it works

1. **Scans TypeScript files**: Recursively finds all `.ts` files in the `src` directory
2. **Generates module paths**: Converts file paths to module paths (e.g., `api/v1/guilds.ts` → `./api/v1/guilds`)
3. **Creates exports object**: Generates the proper exports configuration for both TypeScript types and JavaScript modules
4. **Updates package.json**: Automatically updates the `exports` field

## Usage

The script runs automatically as part of the build process:

```bash
npm run build
```

This will:

1. Compile TypeScript files (`tsc`)
2. Generate exports (`node scripts/generate-exports.js`)

## Benefits

- **No manual maintenance**: Exports are automatically kept in sync with source files
- **Consistent structure**: All modules follow the same export pattern
- **Type safety**: Proper TypeScript resolution for both types and runtime
- **Future-proof**: New files are automatically included in exports

## Generated exports structure

For each TypeScript file `src/api/v1/guilds.ts`, the script generates:

```json
{
  "./api/v1/guilds": {
    "types": "./dist/api/v1/guilds.d.ts",
    "import": "./dist/api/v1/guilds.js"
  }
}
```

This allows consumers to import like:

```typescript
import { Guild } from '@wingtechbot-mk3/types/api/v1/guilds';
```

## Manual execution

You can run the script manually if needed:

```bash
node scripts/generate-exports.js
```

## Adding new files

Simply add new TypeScript files to the `src` directory and run `npm run build`. The exports will be automatically generated for the new files.
