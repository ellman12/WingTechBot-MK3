export default {
    rules: {
        "require-js-extension-for-path-aliases": {
            meta: {
                type: "problem",
                docs: {
                    description: "Require .js extension for TypeScript path alias imports",
                    category: "Required",
                },
                fixable: "code",
                schema: [],
            },
            create(context) {
                return {
                    ImportDeclaration(node) {
                        const importPath = node.source.value;

                        // Check if it's a path alias import (@core, @infrastructure, etc.) or a local import
                        if (importPath.startsWith(".") || /^@(core|infrastructure|application|adapters|db|utils)\//.test(importPath)) {
                            // Check if it's missing an extension
                            if (!/\.[a-z]+$/.test(importPath)) {
                                context.report({
                                    node: node.source,
                                    message: `Import from local file "${importPath}" must include an extension`,
                                    fix(fixer) {
                                        const quote = node.source.raw[0];
                                        const newPath = importPath + ".js";
                                        return fixer.replaceText(node.source, `${quote}${newPath}${quote}`);
                                    },
                                });
                            }
                        }
                    },
                };
            },
        },
    },
};
