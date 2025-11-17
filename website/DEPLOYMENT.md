# Website Deployment Guide

This guide covers deploying the NatsPubsub documentation website to GitHub Pages.

## Overview

The documentation website is built with [Docusaurus](https://docusaurus.io/) and automatically deployed to GitHub Pages when changes are pushed to the `main` branch.

- **Live URL**: https://attaradev.github.io/nats-pubsub/
- **Deployment Branch**: `gh-pages`
- **Trigger**: Push to `main` branch with changes in `website/` or `docs/` directories

## Automatic Deployment

### How It Works

1. Push changes to `main` branch
2. GitHub Actions workflow ([deploy-docs.yml](../.github/workflows/deploy-docs.yml)) is triggered
3. Website is built using `pnpm build`
4. Built files are uploaded to GitHub Pages
5. Site is deployed automatically

### Deployment Triggers

The workflow runs when:

- Changes are pushed to `main` branch in:
  - `website/**` - Website source files
  - `docs/**` - Documentation content
  - `.github/workflows/deploy-docs.yml` - Workflow file itself
- Manual workflow dispatch from GitHub Actions UI

### GitHub Repository Settings

Ensure these settings are configured in your GitHub repository:

1. Go to **Settings** → **Pages**
2. Set **Source** to "GitHub Actions"
3. The workflow will handle the rest

## Local Development

### Prerequisites

- Node.js 18+
- pnpm 10+

### Setup

```bash
# From repository root
cd website
pnpm install
```

### Development Server

Start the development server with hot reload:

```bash
# From repository root
pnpm start:website

# Or from website directory
cd website
pnpm start
```

The site will open at http://localhost:3000

### Build Locally

Test the production build:

```bash
# From repository root
pnpm build:website

# Or from website directory
cd website
pnpm build
```

Built files will be in `website/build/`

### Serve Production Build

Preview the production build locally:

```bash
cd website
pnpm serve
```

## Configuration

### Docusaurus Config

Main configuration: [website/docusaurus.config.ts](./docusaurus.config.ts)

Key settings for GitHub Pages:

```typescript
{
  url: 'https://attaradev.github.io',
  baseUrl: '/nats-pubsub/',
  organizationName: 'attaradev',
  projectName: 'nats-pubsub',
  deploymentBranch: 'gh-pages',
  trailingSlash: false,
}
```

### Custom Domain (Optional)

To use a custom domain like `nats-pubsub.dev`:

1. Update `docusaurus.config.ts`:

   ```typescript
   url: 'https://nats-pubsub.dev',
   baseUrl: '/',
   ```

2. Add `CNAME` file in `website/static/`:

   ```
   nats-pubsub.dev
   ```

3. Configure DNS:

   ```
   A    @    185.199.108.153
   A    @    185.199.109.153
   A    @    185.199.110.153
   A    @    185.199.111.153
   CNAME www  attaradev.github.io
   ```

4. Update GitHub repository settings (Settings → Pages → Custom domain)

## Content Structure

```
website/
├── docs/              # Documentation pages (symlinked from ../docs/)
├── blog/              # Blog posts
├── src/
│   ├── components/    # React components
│   ├── css/          # Custom styles
│   └── pages/        # Custom pages (index, 404, etc.)
├── static/
│   └── img/          # Static images
├── docusaurus.config.ts   # Main config
├── sidebars.ts       # Sidebar navigation
└── package.json
```

## Writing Documentation

### Adding New Docs

1. Create a new `.md` file in `docs/` directory
2. Add frontmatter:

   ```markdown
   ---
   id: my-doc
   title: My Document
   sidebar_label: My Doc
   ---

   Content here...
   ```

3. Update `website/sidebars.ts` if needed
4. Commit and push to `main`

### Adding Blog Posts

1. Create file: `website/blog/YYYY-MM-DD-post-title.md`
2. Add frontmatter:

   ```markdown
   ---
   slug: post-title
   title: Post Title
   authors: [mikeattara]
   tags: [nats, pubsub, release]
   ---

   Content here...

   <!--truncate-->

   More content...
   ```

3. Add author in `website/blog/authors.yml`:
   ```yaml
   mikeattara:
     name: Mike Attara
     title: Creator
     url: https://github.com/attaradev
     image_url: https://github.com/attaradev.png
   ```

## Deployment Workflow Details

### Build Job

```yaml
- Checkout code
- Setup Node.js and pnpm
- Install dependencies
- Build website
- Upload artifact
```

### Deploy Job

```yaml
- Download artifact
- Deploy to GitHub Pages
```

### Environment Variables

No environment variables are required. The workflow uses:

- `GITHUB_TOKEN` - Automatically provided by GitHub Actions
- GitHub Pages deployment action handles authentication

## Troubleshooting

### Build Fails

**Check build locally:**

```bash
cd website
pnpm build
```

**Common issues:**

- Broken links: Fix URLs in markdown files
- Missing dependencies: Run `pnpm install`
- TypeScript errors: Check `docusaurus.config.ts`

### Deployment Fails

**Check workflow logs:**

1. Go to Actions tab in GitHub
2. Click on the failed workflow run
3. Review error logs

**Common issues:**

- GitHub Pages not enabled in repository settings
- Missing permissions in workflow
- Build artifact too large (>1GB)

### 404 Errors on Deployed Site

**Verify base URL:**

```typescript
// Should match your deployment
baseUrl: '/nats-pubsub/',  // For GitHub Pages subdomain
// or
baseUrl: '/',              // For custom domain
```

### Changes Not Reflecting

1. **Clear browser cache** (Ctrl+Shift+R / Cmd+Shift+R)
2. **Check workflow status** in Actions tab
3. **Verify changes in `gh-pages` branch**
4. **Wait 2-3 minutes** for CDN propagation

## Manual Deployment

If needed, you can deploy manually:

### Using GitHub CLI

```bash
cd website
pnpm build

# Deploy using GitHub Pages action
gh workflow run deploy-docs.yml
```

### Using Docusaurus Deploy Command

```bash
# Set environment variables
export GIT_USER=attaradev
export USE_SSH=true

cd website
pnpm deploy
```

## Performance

### Build Times

- **Cold build**: ~2-3 minutes
- **Warm build**: ~1-2 minutes
- **Deployment**: ~30 seconds

### Optimization Tips

1. **Optimize images**: Use WebP format, compress images
2. **Code splitting**: Docusaurus handles this automatically
3. **CDN caching**: GitHub Pages provides automatic CDN
4. **Lighthouse scores**: Aim for 90+ in all categories

## Monitoring

### GitHub Actions

View deployment history:

- Repository → Actions → Deploy Documentation

### Analytics (Optional)

Add Google Analytics in `docusaurus.config.ts`:

```typescript
gtag: {
  trackingID: 'G-XXXXXXXXXX',
  anonymizeIP: true,
}
```

## Security

### Content Security Policy

Add in `docusaurus.config.ts`:

```typescript
scripts: [
  {
    src: '/js/custom.js',
    async: true,
  },
],
```

### Dependabot Updates

Dependabot is configured to update Docusaurus and dependencies automatically.

## Resources

- [Docusaurus Documentation](https://docusaurus.io/docs)
- [GitHub Pages Documentation](https://docs.github.com/en/pages)
- [GitHub Actions Documentation](https://docs.github.com/en/actions)
- [Markdown Guide](https://www.markdownguide.org/)

## Support

If you encounter issues:

1. Check [GitHub Issues](https://github.com/attaradev/nats-pubsub/issues)
2. Review [workflow logs](https://github.com/attaradev/nats-pubsub/actions)
3. Open a new issue with deployment logs
