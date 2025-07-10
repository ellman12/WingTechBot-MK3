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

  export interface Meta<T = any> {
    title: string;
    component?: React.ComponentType<T>;
    parameters?: Record<string, any>;
    argTypes?: Record<string, any>;
  }

  export interface StoryObj<T = any> {
    args?: Partial<T>;
    parameters?: Record<string, any>;
    play?: (context: { canvasElement: HTMLElement }) => Promise<void>;
  }
} 