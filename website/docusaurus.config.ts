import {themes as prismThemes} from 'prism-react-renderer';
import type {Config} from '@docusaurus/types';
import type * as Preset from '@docusaurus/preset-classic';

const config: Config = {
  title: 'NatsPubsub',
  tagline: 'Production-ready pub/sub messaging for NATS JetStream',
  favicon: 'img/favicon.svg',

  // GitHub Pages configuration
  url: 'https://attaradev.github.io',
  baseUrl: '/nats-pubsub/',

  organizationName: 'attaradev',
  projectName: 'nats-pubsub',

  // GitHub Pages deployment config
  deploymentBranch: 'gh-pages',
  trailingSlash: false,

  onBrokenLinks: 'throw',

  i18n: {
    defaultLocale: 'en',
    locales: ['en'],
  },

  markdown: {
    mermaid: true,
    hooks: {
      onBrokenMarkdownLinks: 'warn',
    },
  },
  themes: ['@docusaurus/theme-mermaid'],

  presets: [
    [
      'classic',
      {
        docs: {
          path: '../docs',
          sidebarPath: './sidebars.ts',
          editUrl: 'https://github.com/attaradev/nats-pubsub/tree/main/docs/',
          remarkPlugins: [],
          showLastUpdateTime: true,
        },
        blog: {
          showReadingTime: true,
          editUrl: 'https://github.com/attaradev/nats-pubsub/tree/main/website/',
          blogSidebarTitle: 'All posts',
          blogSidebarCount: 'ALL',
        },
        theme: {
          customCss: './src/css/custom.css',
        },
      } satisfies Preset.Options,
    ],
  ],

  themeConfig: {
    image: 'img/nats-pubsub-social-card.png',
    navbar: {
      title: 'NatsPubsub',
      logo: {
        alt: 'NatsPubsub Logo',
        src: 'img/logo-simple.svg',
        width: 32,
        height: 32,
      },
      items: [
        {
          type: 'docSidebar',
          sidebarId: 'docs',
          position: 'left',
          label: 'Docs',
        },
        {to: '/blog', label: 'Blog', position: 'left'},
        {
          href: 'https://github.com/attaradev/nats-pubsub',
          label: 'GitHub',
          position: 'right',
        },
      ],
    },
    footer: {
      style: 'dark',
      links: [
        {
          title: 'Docs',
          items: [
            {
              label: 'Introduction',
              to: '/docs',
            },
            {
              label: 'JavaScript Examples',
              href: 'https://github.com/attaradev/nats-pubsub/tree/main/packages/javascript/examples',
            },
            {
              label: 'Ruby Examples',
              href: 'https://github.com/attaradev/nats-pubsub/tree/main/packages/ruby/examples',
            },
          ],
        },
        {
          title: 'Community',
          items: [
            {
              label: 'GitHub Discussions',
              href: 'https://github.com/attaradev/nats-pubsub/discussions',
            },
            {
              label: 'GitHub Issues',
              href: 'https://github.com/attaradev/nats-pubsub/issues',
            },
          ],
        },
        {
          title: 'More',
          items: [
            {
              label: 'Blog',
              to: '/blog',
            },
            {
              label: 'GitHub',
              href: 'https://github.com/attaradev/nats-pubsub',
            },
            {
              label: 'npm',
              href: 'https://www.npmjs.com/package/nats-pubsub',
            },
            {
              label: 'RubyGems',
              href: 'https://rubygems.org/gems/nats_pubsub',
            },
          ],
        },
      ],
      copyright: `Copyright © ${new Date().getFullYear()} Mike Attara. Built with Docusaurus.`,
    },
    prism: {
      theme: prismThemes.github,
      darkTheme: prismThemes.dracula,
      additionalLanguages: ['ruby', 'typescript', 'javascript', 'bash', 'yaml', 'json'],
    },
    algolia: {
      appId: 'YOUR_APP_ID',
      apiKey: 'YOUR_API_KEY',
      indexName: 'nats-pubsub',
      contextualSearch: true,
    },
  } satisfies Preset.ThemeConfig,
};

export default config;
