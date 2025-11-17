import React from "react";
import ComponentCreator from "@docusaurus/ComponentCreator";

export default [
  {
    path: "/nats-pubsub/blog",
    component: ComponentCreator("/nats-pubsub/blog", "10e"),
    exact: true,
  },
  {
    path: "/nats-pubsub/blog/archive",
    component: ComponentCreator("/nats-pubsub/blog/archive", "dca"),
    exact: true,
  },
  {
    path: "/nats-pubsub/blog/authors",
    component: ComponentCreator("/nats-pubsub/blog/authors", "ecf"),
    exact: true,
  },
  {
    path: "/nats-pubsub/blog/introducing-natspubsub-1.0",
    component: ComponentCreator(
      "/nats-pubsub/blog/introducing-natspubsub-1.0",
      "fa7",
    ),
    exact: true,
  },
  {
    path: "/nats-pubsub/blog/tags",
    component: ComponentCreator("/nats-pubsub/blog/tags", "b34"),
    exact: true,
  },
  {
    path: "/nats-pubsub/blog/tags/announcement",
    component: ComponentCreator("/nats-pubsub/blog/tags/announcement", "e77"),
    exact: true,
  },
  {
    path: "/nats-pubsub/blog/tags/release",
    component: ComponentCreator("/nats-pubsub/blog/tags/release", "2e9"),
    exact: true,
  },
  {
    path: "/nats-pubsub/search",
    component: ComponentCreator("/nats-pubsub/search", "c12"),
    exact: true,
  },
  {
    path: "/nats-pubsub/docs",
    component: ComponentCreator("/nats-pubsub/docs", "632"),
    routes: [
      {
        path: "/nats-pubsub/docs",
        component: ComponentCreator("/nats-pubsub/docs", "b88"),
        routes: [
          {
            path: "/nats-pubsub/docs",
            component: ComponentCreator("/nats-pubsub/docs", "26e"),
            routes: [
              {
                path: "/nats-pubsub/docs",
                component: ComponentCreator("/nats-pubsub/docs", "854"),
                exact: true,
                sidebar: "docs",
              },
              {
                path: "/nats-pubsub/docs/advanced/architecture",
                component: ComponentCreator(
                  "/nats-pubsub/docs/advanced/architecture",
                  "a45",
                ),
                exact: true,
                sidebar: "docs",
              },
              {
                path: "/nats-pubsub/docs/advanced/custom-repositories",
                component: ComponentCreator(
                  "/nats-pubsub/docs/advanced/custom-repositories",
                  "5cb",
                ),
                exact: true,
                sidebar: "docs",
              },
              {
                path: "/nats-pubsub/docs/advanced/internals",
                component: ComponentCreator(
                  "/nats-pubsub/docs/advanced/internals",
                  "31a",
                ),
                exact: true,
                sidebar: "docs",
              },
              {
                path: "/nats-pubsub/docs/advanced/monitoring",
                component: ComponentCreator(
                  "/nats-pubsub/docs/advanced/monitoring",
                  "c31",
                ),
                exact: true,
              },
              {
                path: "/nats-pubsub/docs/advanced/observability",
                component: ComponentCreator(
                  "/nats-pubsub/docs/advanced/observability",
                  "f7c",
                ),
                exact: true,
              },
              {
                path: "/nats-pubsub/docs/advanced/security",
                component: ComponentCreator(
                  "/nats-pubsub/docs/advanced/security",
                  "0ce",
                ),
                exact: true,
                sidebar: "docs",
              },
              {
                path: "/nats-pubsub/docs/getting-started/concepts",
                component: ComponentCreator(
                  "/nats-pubsub/docs/getting-started/concepts",
                  "c39",
                ),
                exact: true,
                sidebar: "docs",
              },
              {
                path: "/nats-pubsub/docs/getting-started/installation",
                component: ComponentCreator(
                  "/nats-pubsub/docs/getting-started/installation",
                  "566",
                ),
                exact: true,
                sidebar: "docs",
              },
              {
                path: "/nats-pubsub/docs/getting-started/introduction",
                component: ComponentCreator(
                  "/nats-pubsub/docs/getting-started/introduction",
                  "97c",
                ),
                exact: true,
                sidebar: "docs",
              },
              {
                path: "/nats-pubsub/docs/getting-started/quick-start-js",
                component: ComponentCreator(
                  "/nats-pubsub/docs/getting-started/quick-start-js",
                  "a3f",
                ),
                exact: true,
                sidebar: "docs",
              },
              {
                path: "/nats-pubsub/docs/getting-started/quick-start-ruby",
                component: ComponentCreator(
                  "/nats-pubsub/docs/getting-started/quick-start-ruby",
                  "ffa",
                ),
                exact: true,
                sidebar: "docs",
              },
              {
                path: "/nats-pubsub/docs/getting-started/quickstart",
                component: ComponentCreator(
                  "/nats-pubsub/docs/getting-started/quickstart",
                  "06e",
                ),
                exact: true,
              },
              {
                path: "/nats-pubsub/docs/getting-started/rails-quick-start",
                component: ComponentCreator(
                  "/nats-pubsub/docs/getting-started/rails-quick-start",
                  "f57",
                ),
                exact: true,
              },
              {
                path: "/nats-pubsub/docs/getting-started/ruby",
                component: ComponentCreator(
                  "/nats-pubsub/docs/getting-started/ruby",
                  "59d",
                ),
                exact: true,
              },
              {
                path: "/nats-pubsub/docs/guides/deployment",
                component: ComponentCreator(
                  "/nats-pubsub/docs/guides/deployment",
                  "36f",
                ),
                exact: true,
                sidebar: "docs",
              },
              {
                path: "/nats-pubsub/docs/guides/middleware",
                component: ComponentCreator(
                  "/nats-pubsub/docs/guides/middleware",
                  "2ea",
                ),
                exact: true,
                sidebar: "docs",
              },
              {
                path: "/nats-pubsub/docs/guides/monitoring",
                component: ComponentCreator(
                  "/nats-pubsub/docs/guides/monitoring",
                  "97f",
                ),
                exact: true,
              },
              {
                path: "/nats-pubsub/docs/guides/performance",
                component: ComponentCreator(
                  "/nats-pubsub/docs/guides/performance",
                  "cf3",
                ),
                exact: true,
                sidebar: "docs",
              },
              {
                path: "/nats-pubsub/docs/guides/publishing",
                component: ComponentCreator(
                  "/nats-pubsub/docs/guides/publishing",
                  "683",
                ),
                exact: true,
                sidebar: "docs",
              },
              {
                path: "/nats-pubsub/docs/guides/subscribing",
                component: ComponentCreator(
                  "/nats-pubsub/docs/guides/subscribing",
                  "520",
                ),
                exact: true,
                sidebar: "docs",
              },
              {
                path: "/nats-pubsub/docs/guides/testing",
                component: ComponentCreator(
                  "/nats-pubsub/docs/guides/testing",
                  "2eb",
                ),
                exact: true,
                sidebar: "docs",
              },
              {
                path: "/nats-pubsub/docs/guides/topics",
                component: ComponentCreator(
                  "/nats-pubsub/docs/guides/topics",
                  "135",
                ),
                exact: true,
              },
              {
                path: "/nats-pubsub/docs/integrations/databases",
                component: ComponentCreator(
                  "/nats-pubsub/docs/integrations/databases",
                  "274",
                ),
                exact: true,
                sidebar: "docs",
              },
              {
                path: "/nats-pubsub/docs/integrations/express",
                component: ComponentCreator(
                  "/nats-pubsub/docs/integrations/express",
                  "865",
                ),
                exact: true,
                sidebar: "docs",
              },
              {
                path: "/nats-pubsub/docs/integrations/nestjs",
                component: ComponentCreator(
                  "/nats-pubsub/docs/integrations/nestjs",
                  "d48",
                ),
                exact: true,
                sidebar: "docs",
              },
              {
                path: "/nats-pubsub/docs/integrations/rails",
                component: ComponentCreator(
                  "/nats-pubsub/docs/integrations/rails",
                  "de4",
                ),
                exact: true,
                sidebar: "docs",
              },
              {
                path: "/nats-pubsub/docs/intro",
                component: ComponentCreator("/nats-pubsub/docs/intro", "c42"),
                exact: true,
              },
              {
                path: "/nats-pubsub/docs/patterns",
                component: ComponentCreator(
                  "/nats-pubsub/docs/patterns",
                  "4f4",
                ),
                exact: true,
              },
              {
                path: "/nats-pubsub/docs/patterns/dlq",
                component: ComponentCreator(
                  "/nats-pubsub/docs/patterns/dlq",
                  "d79",
                ),
                exact: true,
                sidebar: "docs",
              },
              {
                path: "/nats-pubsub/docs/patterns/error-handling",
                component: ComponentCreator(
                  "/nats-pubsub/docs/patterns/error-handling",
                  "9d9",
                ),
                exact: true,
              },
              {
                path: "/nats-pubsub/docs/patterns/event-sourcing",
                component: ComponentCreator(
                  "/nats-pubsub/docs/patterns/event-sourcing",
                  "bd5",
                ),
                exact: true,
                sidebar: "docs",
              },
              {
                path: "/nats-pubsub/docs/patterns/inbox-outbox",
                component: ComponentCreator(
                  "/nats-pubsub/docs/patterns/inbox-outbox",
                  "a25",
                ),
                exact: true,
                sidebar: "docs",
              },
              {
                path: "/nats-pubsub/docs/patterns/schema-validation",
                component: ComponentCreator(
                  "/nats-pubsub/docs/patterns/schema-validation",
                  "fb1",
                ),
                exact: true,
                sidebar: "docs",
              },
              {
                path: "/nats-pubsub/docs/reference/cli",
                component: ComponentCreator(
                  "/nats-pubsub/docs/reference/cli",
                  "a1d",
                ),
                exact: true,
                sidebar: "docs",
              },
              {
                path: "/nats-pubsub/docs/reference/configuration",
                component: ComponentCreator(
                  "/nats-pubsub/docs/reference/configuration",
                  "aa4",
                ),
                exact: true,
                sidebar: "docs",
              },
              {
                path: "/nats-pubsub/docs/reference/javascript-api",
                component: ComponentCreator(
                  "/nats-pubsub/docs/reference/javascript-api",
                  "b31",
                ),
                exact: true,
                sidebar: "docs",
              },
              {
                path: "/nats-pubsub/docs/reference/ruby-api",
                component: ComponentCreator(
                  "/nats-pubsub/docs/reference/ruby-api",
                  "c2c",
                ),
                exact: true,
                sidebar: "docs",
              },
              {
                path: "/nats-pubsub/docs/troubleshooting/common-issues",
                component: ComponentCreator(
                  "/nats-pubsub/docs/troubleshooting/common-issues",
                  "f9b",
                ),
                exact: true,
                sidebar: "docs",
              },
              {
                path: "/nats-pubsub/docs/troubleshooting/debugging",
                component: ComponentCreator(
                  "/nats-pubsub/docs/troubleshooting/debugging",
                  "f0d",
                ),
                exact: true,
                sidebar: "docs",
              },
              {
                path: "/nats-pubsub/docs/troubleshooting/faq",
                component: ComponentCreator(
                  "/nats-pubsub/docs/troubleshooting/faq",
                  "9e6",
                ),
                exact: true,
                sidebar: "docs",
              },
            ],
          },
        ],
      },
    ],
  },
  {
    path: "/nats-pubsub/",
    component: ComponentCreator("/nats-pubsub/", "b2e"),
    exact: true,
  },
  {
    path: "*",
    component: ComponentCreator("*"),
  },
];
