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
        "single-line-it-calls": {
            meta: {
                type: "layout",
                docs: {
                    description: "Enforce single-line it() test calls",
                    category: "Stylistic Issues",
                },
                fixable: "code",
                schema: [],
            },
            create(context) {
                const sourceCode = context.getSourceCode();

                return {
                    CallExpression(node) {
                        // Only check calls where the callee is "it"
                        if (node.callee.type !== "Identifier" || node.callee.name !== "it" || node.arguments.length < 2) {
                            return;
                        }

                        const firstArg = node.arguments[0];
                        const secondArg = node.arguments[1];

                        // Check if the call spans multiple lines
                        const callStart = sourceCode.getLocFromIndex(node.range[0]);
                        const firstArgStart = sourceCode.getLocFromIndex(firstArg.range[0]);

                        // If the first argument starts on a different line than the call, check if we should fix it
                        if (callStart.line !== firstArgStart.line) {
                            // Get the indentation from the line where the call starts
                            const lines = sourceCode.getLines();
                            const callLine = lines[callStart.line - 1];
                            const indentMatch = callLine.match(/^(\s*)/);
                            const indent = indentMatch ? indentMatch[1] : "";

                            // Get text of each argument
                            const description = sourceCode.getText(firstArg);
                            const testFn = sourceCode.getText(secondArg);
                            const timeoutArg = node.arguments[2] ? `, ${sourceCode.getText(node.arguments[2])}` : "";

                            // Calculate the length of the single-line version
                            const singleLine = `it(${description}, ${testFn}${timeoutArg})`;
                            const fullLineLength = indent.length + singleLine.length;

                            // Only enforce single-line if it would be under 250 characters
                            if (fullLineLength < 250) {
                                context.report({
                                    node,
                                    message: "it() calls should be on a single line",
                                    fix(fixer) {
                                        return fixer.replaceText(node, singleLine);
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
