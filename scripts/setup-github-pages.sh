#!/bin/bash

# GitHub Pages Setup Script for WingTechBot MK3 Documentation
# This script helps you set up GitHub Pages for the documentation site

echo "🚀 Setting up GitHub Pages for WingTechBot MK3 Documentation"
echo "=========================================================="

# Check if we're in a git repository
if ! git rev-parse --git-dir > /dev/null 2>&1; then
    echo "❌ Error: Not in a git repository"
    echo "Please run this script from the root of your repository"
    exit 1
fi

# Get repository information
REPO_URL=$(git config --get remote.origin.url)
REPO_NAME=$(basename -s .git "$REPO_URL")

echo "📋 Repository: $REPO_NAME"
echo "🔗 URL: $REPO_URL"

echo ""
echo "📝 Manual Setup Steps:"
echo "======================"
echo ""
echo "1. Go to your GitHub repository: https://github.com/ellman12/$REPO_NAME"
echo ""
echo "2. Navigate to Settings → Pages"
echo ""
echo "3. Configure GitHub Pages:"
echo "   - Source: Deploy from a branch"
echo "   - Branch: gh-pages"
echo "   - Folder: / (root)"
echo ""
echo "4. Click 'Save'"
echo ""
echo "5. Wait for the first deployment to complete"
echo ""
echo "📖 Your documentation will be available at:"
echo "   https://ellman12.github.io/$REPO_NAME/"
echo ""

# Check if GitHub Actions workflow exists
if [ -f ".github/workflows/deploy-docs.yml" ]; then
    echo "✅ GitHub Actions workflow found"
    echo "   The documentation will be automatically deployed when you push to main"
else
    echo "⚠️  GitHub Actions workflow not found"
    echo "   Please ensure .github/workflows/deploy-docs.yml exists"
fi

echo ""
echo "🔧 Next Steps:"
echo "=============="
echo ""
echo "1. Push your changes to the main branch"
echo "2. Check the Actions tab for deployment status"
echo "3. Visit your documentation site once deployed"
echo ""
echo "📚 For more information, see:"
echo "   - packages/docs/DEPLOYMENT.md"
echo "   - packages/docs/README.md"
echo ""

# Check if we can build the documentation
echo "🔨 Testing build process..."
cd packages/docs

if command -v pnpm &> /dev/null; then
    echo "📦 Installing dependencies..."
    pnpm install
    
    echo "🏗️  Building documentation..."
    if pnpm build; then
        echo "✅ Build successful!"
        echo "   You can test locally with: pnpm preview"
    else
        echo "❌ Build failed. Please check the error messages above."
    fi
else
    echo "⚠️  pnpm not found. Please install pnpm first:"
    echo "   npm install -g pnpm"
fi

echo ""
echo "🎉 Setup complete! Follow the manual steps above to enable GitHub Pages." 