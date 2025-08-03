# GitHub Pages Deployment

This guide explains how to deploy the WingTechBot MK3 documentation to GitHub Pages.

## Automatic Deployment

The documentation is automatically deployed to GitHub Pages using GitHub Actions. The workflow is configured in `.github/workflows/deploy-docs.yml`.

### How it works:

1. **Trigger**: The workflow runs when changes are pushed to the `main` branch that affect files in `packages/docs/`
2. **Build**: The documentation site is built using Vite
3. **Deploy**: The built files are deployed to the `gh-pages` branch
4. **Publish**: GitHub Pages serves the site from the `gh-pages` branch

### Prerequisites:

1. **GitHub Pages enabled**: Go to your repository settings → Pages
2. **Source**: Set to "Deploy from a branch"
3. **Branch**: Select `gh-pages` branch
4. **Folder**: Select `/ (root)`

## Manual Deployment

If you prefer to deploy manually:

### 1. Build the documentation

```bash
cd packages/docs
pnpm build
```

### 2. Deploy to GitHub Pages

```bash
# Install gh-pages package
pnpm add -D gh-pages

# Add deploy script to package.json
# "deploy": "gh-pages -d dist"

# Deploy
pnpm deploy
```

## Configuration

### Base URL

The documentation is configured to work with GitHub Pages by setting the base URL to `/WingTechBot-MK3/` in production. This is handled in `vite.config.ts`:

```typescript
base: process.env.NODE_ENV === 'production' ? '/WingTechBot-MK3/' : '/',
```

### Custom Domain (Optional)

To use a custom domain:

1. Add a `CNAME` file to the `gh-pages` branch with your domain
2. Configure DNS settings for your domain
3. Enable HTTPS in GitHub Pages settings

## Troubleshooting

### Build Issues

- **Node version**: Ensure you're using Node.js 18+
- **Dependencies**: Run `pnpm install` to install all dependencies
- **Build errors**: Check the build output for specific error messages

### Deployment Issues

- **GitHub Actions**: Check the Actions tab for workflow failures
- **Permissions**: Ensure the workflow has permission to write to the repository
- **Branch protection**: Make sure `gh-pages` branch isn't protected

### Site Not Loading

- **Base URL**: Verify the base URL is correct for your repository name
- **404 errors**: Check that all assets are being served correctly
- **Routing**: Ensure React Router is configured for the base URL

## Local Development

For local development, the site runs on `http://localhost:5173`:

```bash
cd packages/docs
pnpm dev
```

## Production Build Testing

To test the production build locally:

```bash
cd packages/docs
pnpm build
pnpm preview
```

This will serve the built files locally so you can verify everything works before deployment.

## Repository Settings

### Required Settings

1. **Pages**: Enable GitHub Pages
2. **Actions**: Enable GitHub Actions
3. **Workflows**: Allow the deployment workflow to run

### Optional Settings

1. **Branch protection**: Protect the `main` branch
2. **Required checks**: Require the deployment workflow to pass
3. **Auto-delete**: Enable automatic deletion of head branches

## Security

- **Secrets**: The workflow uses `GITHUB_TOKEN` which is automatically provided
- **Permissions**: The workflow only has access to the repository contents
- **Dependencies**: All dependencies are locked and verified

## Performance

- **Caching**: GitHub Actions caches dependencies for faster builds
- **Optimization**: The build process optimizes assets for production
- **CDN**: GitHub Pages serves content through a global CDN

## Monitoring

- **Build status**: Check the Actions tab for build status
- **Deployment logs**: Review deployment logs for any issues
- **Site status**: Monitor the deployed site for any problems

For more information, see the [GitHub Pages documentation](https://docs.github.com/en/pages).
