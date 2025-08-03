/// <reference types="vite/client" />

declare module '*.css' {
  const content: string;
  export default content;
}

declare module '*.scss' {
  const content: string;
  export default content;
}

declare module '*.sass' {
  const content: string;
  export default content;
}

// Storybook types
declare module '@storybook/react-vite' {
  export interface StorybookConfig {
    stories: string[];
    addons: string[];
    framework: {
      name: string;
      options: Record<string, unknown>;
    };
    typescript?: {
      reactDocgen: string;
    };
  }

  export interface Preview {
    parameters?: {
      controls?: {
        matchers?: {
          color?: RegExp;
          date?: RegExp;
        };
      };
    };
  }
}
