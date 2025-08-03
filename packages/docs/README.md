# WingTechBot MK3 Documentation

This package contains the developer documentation for WingTechBot MK3, built with React, TypeScript, and Vite.

## Features

- 📚 **Comprehensive Documentation**: Complete guides for installation, development, API, and architecture
- 🎨 **Modern UI**: Built with Material-UI and responsive design
- 🌙 **Dark/Light Mode**: Toggle between themes
- 📱 **Mobile Responsive**: Works on all device sizes
- ⚡ **Fast Loading**: Optimized with Vite and code splitting
- 🔍 **Search**: Easy navigation and content discovery

## Quick Start

### Development

```bash
# Install dependencies
pnpm install

# Start development server
pnpm dev

# Build for production
pnpm build

# Preview production build
pnpm preview
```

### Deployment

The documentation is automatically deployed to GitHub Pages when changes are pushed to the main branch.

#### Manual Deployment

```bash
# Build the site
pnpm build

# Deploy to GitHub Pages
pnpm deploy
```

## Project Structure

```
src/
├── components/          # React components
│   ├── MarkdownPage.tsx # Main content page
│   ├── MarkdownRenderer.tsx # Markdown rendering
│   └── Sidebar.tsx     # Navigation sidebar
├── content/            # Markdown documentation files
│   ├── quick-start.md
│   ├── installation.md
│   ├── development.md
│   ├── api.md
│   └── architecture.md
├── config/             # Configuration
│   └── content.ts      # Content routing and navigation
├── contexts/           # React contexts
│   └── ThemeContext.tsx # Theme management
├── hooks/              # Custom React hooks
│   └── useTheme.ts     # Theme hook
├── pages/              # Page components
│   └── HomePage.tsx    # Landing page
├── utils/              # Utility functions
│   └── markdownLoader.ts # Markdown content loading
├── App.tsx             # Main application component
└── main.tsx            # Application entry point
```

## Content Management

### Adding New Pages

1. **Create markdown file** in `src/content/`
2. **Add to content config** in `src/config/content.ts`
3. **Import in markdown loader** in `src/utils/markdownLoader.ts`

### Example

```typescript
// 1. Create src/content/new-page.md
# New Page Title

Content goes here...

// 2. Add to src/config/content.ts
{
  id: 'new-page',
  title: 'New Page',
  path: '/guide/new-page',
  order: 1,
  category: 'guide'
}

// 3. Import in src/utils/markdownLoader.ts
import newPageContent from '../content/new-page.md?raw'

export const MARKDOWN_CONTENT = {
  // ... existing content
  'new-page': newPageContent,
}
```

## Styling

The documentation uses Material-UI with custom theming:

- **Light/Dark Mode**: Automatic theme switching
- **Responsive Design**: Mobile-first approach
- **Custom Components**: Styled markdown renderer
- **Typography**: Consistent font hierarchy

## Build Configuration

### Vite Config

The site is configured for GitHub Pages deployment with the correct base URL:

```typescript
base: process.env.NODE_ENV === "production" ? "/WingTechBot-MK3/" : "/";
```

### Build Output

- **Output Directory**: `dist/`
- **Assets**: Optimized and hashed
- **Source Maps**: Generated for debugging
- **Bundle Analysis**: Available with `pnpm build --analyze`

## Performance

- **Code Splitting**: Automatic route-based splitting
- **Lazy Loading**: Components loaded on demand
- **Asset Optimization**: Images and fonts optimized
- **Caching**: Proper cache headers for static assets

## Browser Support

- **Modern Browsers**: Chrome, Firefox, Safari, Edge (latest 2 versions)
- **Mobile**: iOS Safari, Chrome Mobile
- **Progressive Enhancement**: Works without JavaScript

## Contributing

1. **Fork the repository**
2. **Create a feature branch**
3. **Make your changes**
4. **Test locally**: `pnpm dev`
5. **Build and test**: `pnpm build && pnpm preview`
6. **Submit a pull request**

## Deployment

### GitHub Pages

The documentation is automatically deployed to GitHub Pages using GitHub Actions:

- **Trigger**: Push to main branch
- **Build**: Vite production build
- **Deploy**: gh-pages branch
- **URL**: `https://ellman12.github.io/WingTechBot-MK3/`

### Manual Deployment

```bash
# Build the site
pnpm build

# Deploy to GitHub Pages
pnpm deploy
```

### Custom Domain

To use a custom domain:

1. Add `CNAME` file to `gh-pages` branch
2. Configure DNS settings
3. Enable HTTPS in GitHub Pages settings

## Troubleshooting

### Build Issues

- **Node version**: Ensure Node.js 18+
- **Dependencies**: Run `pnpm install`
- **TypeScript errors**: Check `pnpm lint`

### Deployment Issues

- **GitHub Actions**: Check Actions tab
- **Permissions**: Ensure workflow permissions
- **Base URL**: Verify repository name in config

### Content Issues

- **Markdown syntax**: Use proper markdown formatting
- **Links**: Use relative paths for internal links
- **Images**: Place in `public/` directory

## License

MIT License - see the main repository for details.
