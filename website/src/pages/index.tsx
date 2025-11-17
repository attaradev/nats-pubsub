import clsx from 'clsx';
import Link from '@docusaurus/Link';
import useDocusaurusContext from '@docusaurus/useDocusaurusContext';
import Layout from '@theme/Layout';
import Heading from '@theme/Heading';
import styles from './index.module.css';

type FeatureItem = {
  title: string;
  icon: string;
  description: JSX.Element;
};

const FeatureList: FeatureItem[] = [
  {
    title: 'Declarative API',
    icon: '🎯',
    description: (
      <>
        Clean, intuitive subscriber API inspired by Rails and NestJS. Write less boilerplate, focus on business logic.
      </>
    ),
  },
  {
    title: 'Battle-Tested Reliability',
    icon: '🔒',
    description: (
      <>
        Built-in Inbox/Outbox patterns, Dead Letter Queue, and automatic retries ensure your messages are delivered.
      </>
    ),
  },
  {
    title: 'Cross-Language',
    icon: '🌐',
    description: (
      <>
        Full TypeScript and Ruby implementations with identical APIs. Build polyglot microservices with ease.
      </>
    ),
  },
  {
    title: 'Production Ready',
    icon: '⚡',
    description: (
      <>
        Comprehensive monitoring, health checks, and observability. Battle-tested in high-throughput production systems.
      </>
    ),
  },
  {
    title: 'Developer Experience',
    icon: '🧪',
    description: (
      <>
        Extensive testing utilities, fake modes, and comprehensive documentation make development a breeze.
      </>
    ),
  },
  {
    title: 'Auto-Topology',
    icon: '🔧',
    description: (
      <>
        Automatic JetStream stream and consumer management. No manual NATS configuration required.
      </>
    ),
  },
];

function Feature({title, icon, description}: FeatureItem) {
  return (
    <div className={clsx('col col--4')}>
      <div className="text--center padding-horiz--md padding-vert--md">
        <div className={styles.featureIcon}>{icon}</div>
        <Heading as="h3">{title}</Heading>
        <p>{description}</p>
      </div>
    </div>
  );
}

export default function Home(): JSX.Element {
  const {siteConfig} = useDocusaurusContext();
  return (
    <Layout
      title={`${siteConfig.title} - ${siteConfig.tagline}`}
      description="Production-ready pub/sub messaging for NATS JetStream">
      <header className={clsx('hero hero--primary', styles.heroBanner)}>
        <div className="container">
          <Heading as="h1" className="hero__title">
            {siteConfig.title}
          </Heading>
          <p className="hero__subtitle">{siteConfig.tagline}</p>
          <div className={styles.buttons}>
            <Link
              className="button button--secondary button--lg"
              to="/docs/intro">
              Get Started ⏱️
            </Link>
            <Link
              className="button button--outline button--secondary button--lg"
              to="https://github.com/attaradev/nats-pubsub"
              style={{marginLeft: '1rem'}}>
              View on GitHub
            </Link>
          </div>
        </div>
      </header>
      <main>
        <section className={styles.features}>
          <div className="container">
            <div className="row">
              {FeatureList.map((props, idx) => (
                <Feature key={idx} {...props} />
              ))}
            </div>
          </div>
        </section>

        <section className={styles.codeExample}>
          <div className="container">
            <div className="row">
              <div className="col col--6">
                <Heading as="h2">JavaScript/TypeScript</Heading>
                <pre>
                  <code className="language-typescript">
{`import { Publisher, Subscriber } from 'nats-pubsub';

// Publish a message
const publisher = new Publisher(config);
await publisher.publish('order.created', {
  orderId: '123',
  amount: 99.99
});

// Subscribe to messages
class OrderSubscriber extends Subscriber {
  constructor() {
    super('order.created');
  }

  async handle(message, metadata) {
    await processOrder(message);
  }
}`}
                  </code>
                </pre>
              </div>
              <div className="col col--6">
                <Heading as="h2">Ruby</Heading>
                <pre>
                  <code className="language-ruby">
{`require 'nats_pubsub'

# Publish a message
NatsPubsub.publish('order.created', {
  order_id: '123',
  amount: 99.99
})

# Subscribe to messages
class OrderSubscriber < NatsPubsub::Subscriber
  subscribe_to 'order.created'

  def handle(message, context)
    process_order(message)
  end
end`}
                  </code>
                </pre>
              </div>
            </div>
          </div>
        </section>

        <section className={styles.callToAction}>
          <div className="container text--center">
            <Heading as="h2">Ready to get started?</Heading>
            <p>Choose your language and start building in minutes</p>
            <div className={styles.buttons}>
              <Link
                className="button button--primary button--lg"
                to="https://github.com/attaradev/nats-pubsub/tree/main/packages/javascript/examples">
                JavaScript Examples
              </Link>
              <Link
                className="button button--primary button--lg"
                to="https://github.com/attaradev/nats-pubsub/tree/main/packages/ruby/examples"
                style={{marginLeft: '1rem'}}>
                Ruby Examples
              </Link>
            </div>
          </div>
        </section>
      </main>
    </Layout>
  );
}
