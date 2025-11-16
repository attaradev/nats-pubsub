# NatsPubsub Documentation Website

This website is built using [Docusaurus 3](https://docusaurus.io/), a modern static website generator.

## Installation

```bash
cd website
npm install
# or
pnpm install
```

## Local Development

```bash
npm start
# or
pnpm start
```

This command starts a local development server and opens up a browser window. Most changes are reflected live without having to restart the server.

## Build

```bash
npm run build
# or
pnpm build
```

This command generates static content into the `build` directory and can be served using any static contents hosting service.

## Deployment

### Using SSH

```bash
USE_SSH=true npm run deploy
```

### Not using SSH

```bash
GIT_USER=<Your GitHub username> npm run deploy
```

If you are using GitHub pages for hosting, this command is a convenient way to build the website and push to the `gh-pages` branch.

## Directory Structure

```
website/
├── blog/                   # Blog posts
│   └── 2025-01-15-*.md
├── docs/                   # Symlink to ../docs
├── src/
│   ├── components/         # React components
│   ├── css/               # Custom CSS
│   └── pages/             # React pages
│       ├── index.tsx      # Homepage
│       └── index.module.css
├── static/
│   └── img/               # Static images
│       ├── logo.svg
│       └── favicon.ico
├── docusaurus.config.ts   # Site configuration
├── sidebars.ts            # Sidebar configuration
├── package.json
└── tsconfig.json
```

## Features

### Built-in Features

- ✅ Search (Algolia DocSearch)
- ✅ Dark mode
- ✅ Blog with RSS
- ✅ Code syntax highlighting
- ✅ Mermaid diagrams
- ✅ Edit on GitHub links
- ✅ Last update timestamps
- ✅ Responsive design
- ✅ SEO optimized

### Custom Features

- ✅ Custom brand colors (#27c9b6)
- ✅ Animated logo
- ✅ Code examples for JavaScript and Ruby
- ✅ Feature showcase
- ✅ Call-to-action sections

## Customization

### Colors

Edit `src/css/custom.css` to change the color scheme:

```css
:root {
  --ifm-color-primary: #27c9b6;
  --ifm-color-primary-dark: #23b4a3;
  /* ... */
}
```

### Navigation

Edit `docusaurus.config.ts` to modify the navbar:

```typescript
navbar: {
  items: [
    { text: 'Docs', to: '/docs/intro' },
    // Add more items
  ],
}
```

### Sidebar

Edit `sidebars.ts` to modify the documentation sidebar structure.

## Search Setup

To enable Algolia DocSearch:

1. Apply for DocSearch at <https://docsearch.algolia.com/apply/>
2. Update `docusaurus.config.ts` with your credentials:

```typescript
algolia: {
  appId: 'YOUR_APP_ID',
  apiKey: 'YOUR_API_KEY',
  indexName: 'nats-pubsub',
},
```

## Deployment Options

### GitHub Pages

```bash
# Set in docusaurus.config.ts
organizationName: 'attaradev'
projectName: 'nats-pubsub'

# Deploy
npm run deploy
```

### Netlify

1. Connect your repository to Netlify
2. Set build command: `cd website && npm run build`
3. Set publish directory: `website/build`

### Vercel

1. Import your repository to Vercel
2. Set root directory: `website`
3. Build command: `npm run build`
4. Output directory: `build`

### Docker

```dockerfile
FROM node:18-alpine

WORKDIR /app
COPY website/package.json website/package-lock.json ./
RUN npm ci

COPY website/ ./
RUN npm run build

FROM nginx:alpine
COPY --from=0 /app/build /usr/share/nginx/html
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
```

Build and run:

```bash
docker build -t nats-pubsub-docs .
docker run -p 8080:80 nats-pubsub-docs
```

## Contributing

To contribute to the documentation:

1. Edit the markdown files in `../docs/`
2. Test locally with `npm start`
3. Submit a pull request

## Support

- [Docusaurus Documentation](https://docusaurus.io/)
- [Docusaurus Discord](https://discord.gg/docusaurus)
- [NatsPubsub GitHub](https://github.com/attaradev/nats-pubsub)

## License

MIT
