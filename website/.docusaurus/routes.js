import React from "react";
import ComponentCreator from "@docusaurus/ComponentCreator";

export default [
  {
    path: "/nats-pubsub/__docusaurus/debug",
    component: ComponentCreator("/nats-pubsub/__docusaurus/debug", "9c4"),
    exact: true,
  },
  {
    path: "/nats-pubsub/__docusaurus/debug/config",
    component: ComponentCreator(
      "/nats-pubsub/__docusaurus/debug/config",
      "e2a",
    ),
    exact: true,
  },
  {
    path: "/nats-pubsub/__docusaurus/debug/content",
    component: ComponentCreator(
      "/nats-pubsub/__docusaurus/debug/content",
      "cbf",
    ),
    exact: true,
  },
  {
    path: "/nats-pubsub/__docusaurus/debug/globalData",
    component: ComponentCreator(
      "/nats-pubsub/__docusaurus/debug/globalData",
      "475",
    ),
    exact: true,
  },
  {
    path: "/nats-pubsub/__docusaurus/debug/metadata",
    component: ComponentCreator(
      "/nats-pubsub/__docusaurus/debug/metadata",
      "be7",
    ),
    exact: true,
  },
  {
    path: "/nats-pubsub/__docusaurus/debug/registry",
    component: ComponentCreator(
      "/nats-pubsub/__docusaurus/debug/registry",
      "06f",
    ),
    exact: true,
  },
  {
    path: "/nats-pubsub/__docusaurus/debug/routes",
    component: ComponentCreator(
      "/nats-pubsub/__docusaurus/debug/routes",
      "95c",
    ),
    exact: true,
  },
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
    component: ComponentCreator("/nats-pubsub/docs", "c78"),
    routes: [
      {
        path: "/nats-pubsub/docs",
        component: ComponentCreator("/nats-pubsub/docs", "af0"),
        routes: [
          {
            path: "/nats-pubsub/docs",
            component: ComponentCreator("/nats-pubsub/docs", "97b"),
            routes: [
              {
                path: "/nats-pubsub/docs",
                component: ComponentCreator("/nats-pubsub/docs", "6ec"),
                exact: true,
              },
              {
                path: "/nats-pubsub/docs/advanced/architecture",
                component: ComponentCreator(
                  "/nats-pubsub/docs/advanced/architecture",
                  "a3f",
                ),
                exact: true,
                sidebar: "docs",
              },
              {
                path: "/nats-pubsub/docs/advanced/custom-repositories",
                component: ComponentCreator(
                  "/nats-pubsub/docs/advanced/custom-repositories",
                  "3f2",
                ),
                exact: true,
                sidebar: "docs",
              },
              {
                path: "/nats-pubsub/docs/advanced/internals",
                component: ComponentCreator(
                  "/nats-pubsub/docs/advanced/internals",
                  "4d2",
                ),
                exact: true,
                sidebar: "docs",
              },
              {
                path: "/nats-pubsub/docs/advanced/security",
                component: ComponentCreator(
                  "/nats-pubsub/docs/advanced/security",
                  "42d",
                ),
                exact: true,
                sidebar: "docs",
              },
              {
                path: "/nats-pubsub/docs/blog",
                component: ComponentCreator("/nats-pubsub/docs/blog", "439"),
                exact: true,
              },
              {
                path: "/nats-pubsub/docs/getting-started/concepts",
                component: ComponentCreator(
                  "/nats-pubsub/docs/getting-started/concepts",
                  "17b",
                ),
                exact: true,
                sidebar: "docs",
              },
              {
                path: "/nats-pubsub/docs/getting-started/installation",
                component: ComponentCreator(
                  "/nats-pubsub/docs/getting-started/installation",
                  "5df",
                ),
                exact: true,
                sidebar: "docs",
              },
              {
                path: "/nats-pubsub/docs/getting-started/introduction",
                component: ComponentCreator(
                  "/nats-pubsub/docs/getting-started/introduction",
                  "9c8",
                ),
                exact: true,
                sidebar: "docs",
              },
              {
                path: "/nats-pubsub/docs/getting-started/quick-start-js",
                component: ComponentCreator(
                  "/nats-pubsub/docs/getting-started/quick-start-js",
                  "323",
                ),
                exact: true,
                sidebar: "docs",
              },
              {
                path: "/nats-pubsub/docs/getting-started/quick-start-ruby",
                component: ComponentCreator(
                  "/nats-pubsub/docs/getting-started/quick-start-ruby",
                  "073",
                ),
                exact: true,
                sidebar: "docs",
              },
              {
                path: "/nats-pubsub/docs/guides/deployment",
                component: ComponentCreator(
                  "/nats-pubsub/docs/guides/deployment",
                  "6a5",
                ),
                exact: true,
                sidebar: "docs",
              },
              {
                path: "/nats-pubsub/docs/guides/middleware",
                component: ComponentCreator(
                  "/nats-pubsub/docs/guides/middleware",
                  "f7d",
                ),
                exact: true,
                sidebar: "docs",
              },
              {
                path: "/nats-pubsub/docs/guides/performance",
                component: ComponentCreator(
                  "/nats-pubsub/docs/guides/performance",
                  "a5d",
                ),
                exact: true,
                sidebar: "docs",
              },
              {
                path: "/nats-pubsub/docs/guides/publishing",
                component: ComponentCreator(
                  "/nats-pubsub/docs/guides/publishing",
                  "604",
                ),
                exact: true,
                sidebar: "docs",
              },
              {
                path: "/nats-pubsub/docs/guides/subscribing",
                component: ComponentCreator(
                  "/nats-pubsub/docs/guides/subscribing",
                  "d17",
                ),
                exact: true,
                sidebar: "docs",
              },
              {
                path: "/nats-pubsub/docs/guides/testing",
                component: ComponentCreator(
                  "/nats-pubsub/docs/guides/testing",
                  "a92",
                ),
                exact: true,
                sidebar: "docs",
              },
              {
                path: "/nats-pubsub/docs/integrations/databases",
                component: ComponentCreator(
                  "/nats-pubsub/docs/integrations/databases",
                  "c14",
                ),
                exact: true,
                sidebar: "docs",
              },
              {
                path: "/nats-pubsub/docs/integrations/express",
                component: ComponentCreator(
                  "/nats-pubsub/docs/integrations/express",
                  "800",
                ),
                exact: true,
                sidebar: "docs",
              },
              {
                path: "/nats-pubsub/docs/integrations/nestjs",
                component: ComponentCreator(
                  "/nats-pubsub/docs/integrations/nestjs",
                  "d9f",
                ),
                exact: true,
                sidebar: "docs",
              },
              {
                path: "/nats-pubsub/docs/integrations/rails",
                component: ComponentCreator(
                  "/nats-pubsub/docs/integrations/rails",
                  "7ea",
                ),
                exact: true,
                sidebar: "docs",
              },
              {
                path: "/nats-pubsub/docs/intro",
                component: ComponentCreator("/nats-pubsub/docs/intro", "87d"),
                exact: true,
                sidebar: "docs",
              },
              {
                path: "/nats-pubsub/docs/patterns/dlq",
                component: ComponentCreator(
                  "/nats-pubsub/docs/patterns/dlq",
                  "ddc",
                ),
                exact: true,
                sidebar: "docs",
              },
              {
                path: "/nats-pubsub/docs/patterns/event-sourcing",
                component: ComponentCreator(
                  "/nats-pubsub/docs/patterns/event-sourcing",
                  "2b6",
                ),
                exact: true,
                sidebar: "docs",
              },
              {
                path: "/nats-pubsub/docs/patterns/inbox-outbox",
                component: ComponentCreator(
                  "/nats-pubsub/docs/patterns/inbox-outbox",
                  "b45",
                ),
                exact: true,
                sidebar: "docs",
              },
              {
                path: "/nats-pubsub/docs/patterns/schema-validation",
                component: ComponentCreator(
                  "/nats-pubsub/docs/patterns/schema-validation",
                  "7f7",
                ),
                exact: true,
                sidebar: "docs",
              },
              {
                path: "/nats-pubsub/docs/reference/cli",
                component: ComponentCreator(
                  "/nats-pubsub/docs/reference/cli",
                  "cfb",
                ),
                exact: true,
                sidebar: "docs",
              },
              {
                path: "/nats-pubsub/docs/reference/configuration",
                component: ComponentCreator(
                  "/nats-pubsub/docs/reference/configuration",
                  "142",
                ),
                exact: true,
                sidebar: "docs",
              },
              {
                path: "/nats-pubsub/docs/reference/javascript-api",
                component: ComponentCreator(
                  "/nats-pubsub/docs/reference/javascript-api",
                  "77d",
                ),
                exact: true,
                sidebar: "docs",
              },
              {
                path: "/nats-pubsub/docs/reference/ruby-api",
                component: ComponentCreator(
                  "/nats-pubsub/docs/reference/ruby-api",
                  "7c3",
                ),
                exact: true,
                sidebar: "docs",
              },
              {
                path: "/nats-pubsub/docs/troubleshooting/common-issues",
                component: ComponentCreator(
                  "/nats-pubsub/docs/troubleshooting/common-issues",
                  "b9b",
                ),
                exact: true,
                sidebar: "docs",
              },
              {
                path: "/nats-pubsub/docs/troubleshooting/debugging",
                component: ComponentCreator(
                  "/nats-pubsub/docs/troubleshooting/debugging",
                  "940",
                ),
                exact: true,
                sidebar: "docs",
              },
              {
                path: "/nats-pubsub/docs/troubleshooting/faq",
                component: ComponentCreator(
                  "/nats-pubsub/docs/troubleshooting/faq",
                  "faa",
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
