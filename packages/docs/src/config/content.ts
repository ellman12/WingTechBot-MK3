// Content configuration for auto-generating routes and navigation
export type ContentItem = {
    id: string;
    title: string;
    path: string;
    order: number;
    category: "guide" | "api" | "architecture";
    icon?: string;
    description?: string;
};

export type ContentCategory = {
    name: string;
    order: number;
    items: ContentItem[];
};

// Content configuration with ordering
export const CONTENT_CONFIG: ContentCategory[] = [
    {
        name: "Getting Started",
        order: 1,
        items: [
            {
                id: "quick-start",
                title: "Quick Start",
                path: "/guide/quick-start",
                order: 1,
                category: "guide",
                description: "Get up and running quickly with WingTechBot MK3",
            },
            {
                id: "installation",
                title: "Installation",
                path: "/guide/installation",
                order: 2,
                category: "guide",
                description: "Detailed installation instructions",
            },
        ],
    },
    {
        name: "Development",
        order: 2,
        items: [
            {
                id: "development",
                title: "Development Guide",
                path: "/guide/development",
                order: 1,
                category: "guide",
                description: "Complete development workflow and best practices",
            },
            {
                id: "database",
                title: "Database",
                path: "/guide/database",
                order: 2,
                category: "guide",
                description: "Database setup and management",
            },
            {
                id: "discord-bot",
                title: "Discord Bot",
                path: "/guide/discord-bot",
                order: 3,
                category: "guide",
                description: "Discord bot configuration and features",
            },
            {
                id: "frontend",
                title: "Frontend",
                path: "/guide/frontend",
                order: 4,
                category: "guide",
                description: "Frontend development guide",
            },
            {
                id: "deployment",
                title: "Deployment",
                path: "/guide/deployment",
                order: 5,
                category: "guide",
                description: "Production deployment guide",
            },
        ],
    },
    {
        name: "API & Architecture",
        order: 3,
        items: [
            {
                id: "api",
                title: "API Reference",
                path: "/api",
                order: 1,
                category: "api",
                description: "Complete API documentation",
            },
            {
                id: "architecture",
                title: "System Architecture",
                path: "/architecture",
                order: 2,
                category: "architecture",
                description: "System design and architectural patterns",
            },
        ],
    },
];

// Helper functions
export function getAllContentItems(): ContentItem[] {
    return CONTENT_CONFIG.flatMap(category => category.items).sort((a, b) => a.order - b.order);
}

export function getContentItemById(id: string): ContentItem | undefined {
    return getAllContentItems().find(item => item.id === id);
}

export function getContentItemByPath(path: string): ContentItem | undefined {
    return getAllContentItems().find(item => item.path === path);
}

export function getRoutes(): Array<{ path: string; id: string }> {
    return getAllContentItems().map(item => ({
        path: item.path,
        id: item.id,
    }));
}

export function getSidebarNavigation() {
    return CONTENT_CONFIG.sort((a, b) => a.order - b.order).map(category => ({
        ...category,
        items: category.items.sort((a, b) => a.order - b.order),
    }));
}
