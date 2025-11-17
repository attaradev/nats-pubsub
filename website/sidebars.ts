import type {SidebarsConfig} from '@docusaurus/plugin-content-docs';

const sidebars: SidebarsConfig = {
  docs: [
    'index',
    {
      type: 'category',
      label: 'Getting Started',
      collapsed: false,
      items: [
        'getting-started/introduction',
        'getting-started/installation',
        'getting-started/quick-start-js',
        'getting-started/quick-start-ruby',
        'getting-started/concepts',
      ],
    },
    {
      type: 'category',
      label: 'Guides',
      collapsed: false,
      items: [
        'guides/publishing',
        'guides/subscribing',
        'guides/middleware',
        'guides/testing',
        'guides/deployment',
        'guides/performance',
      ],
    },
    {
      type: 'category',
      label: 'Patterns',
      items: [
        'patterns/inbox-outbox',
        'patterns/dlq',
        'patterns/schema-validation',
        'patterns/event-sourcing',
      ],
    },
    {
      type: 'category',
      label: 'Integrations',
      items: [
        'integrations/rails',
        'integrations/express',
        'integrations/nestjs',
        'integrations/databases',
      ],
    },
    {
      type: 'category',
      label: 'Reference',
      items: [
        'reference/javascript-api',
        'reference/ruby-api',
        'reference/configuration',
        'reference/cli',
      ],
    },
    {
      type: 'category',
      label: 'Advanced',
      items: [
        'advanced/architecture',
        'advanced/internals',
        'advanced/custom-repositories',
        'advanced/security',
      ],
    },
    {
      type: 'category',
      label: 'Troubleshooting',
      items: [
        'troubleshooting/common-issues',
        'troubleshooting/debugging',
        'troubleshooting/faq',
      ],
    },
  ],
};

export default sidebars;
