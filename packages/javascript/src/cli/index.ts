#!/usr/bin/env node
import { Command } from 'commander';
import config from '../core/config.js';
import connection from '../core/connection.js';
import consumer from '../subscribers/consumer.js';

const program = new Command();

program.name('nats-pubsub').description('CLI tool for NatsPubsub management').version('0.2.0');

/**
 * Start command - Start the consumer to process messages
 */
program
  .command('start')
  .description('Start consumer to process messages')
  .option('-e, --env <env>', 'Environment (default: development)', 'development')
  .option('-a, --app <name>', 'Application name', 'app')
  .option('-u, --url <url>', 'NATS server URL', 'nats://localhost:4222')
  .option('-c, --concurrency <number>', 'Message concurrency', '10')
  .action(async (options) => {
    try {
      config.configure({
        env: options.env,
        appName: options.app,
        natsUrls: options.url,
        concurrency: parseInt(options.concurrency, 10),
      });

      console.log(`Starting NatsPubsub consumer...`);
      console.log(`  Environment: ${options.env}`);
      console.log(`  App Name: ${options.app}`);
      console.log(`  NATS URL: ${options.url}`);
      console.log(`  Concurrency: ${options.concurrency}`);

      await consumer.start();
      console.log('Consumer started successfully');

      // Handle graceful shutdown
      process.on('SIGINT', async () => {
        console.log('\nReceived SIGINT, shutting down gracefully...');
        await consumer.stop();
        await connection.disconnect();
        process.exit(0);
      });

      process.on('SIGTERM', async () => {
        console.log('\nReceived SIGTERM, shutting down gracefully...');
        await consumer.stop();
        await connection.disconnect();
        process.exit(0);
      });
    } catch (error) {
      console.error('Failed to start consumer:', error);
      process.exit(1);
    }
  });

/**
 * Info command - Show stream and configuration information
 */
program
  .command('info')
  .description('Show stream and configuration information')
  .option('-e, --env <env>', 'Environment (default: development)', 'development')
  .option('-a, --app <name>', 'Application name', 'app')
  .option('-u, --url <url>', 'NATS server URL', 'nats://localhost:4222')
  .action(async (options) => {
    try {
      config.configure({
        env: options.env,
        appName: options.app,
        natsUrls: options.url,
      });

      await connection.ensureConnection();
      const nc = connection.getConnection();
      const jsm = await nc.jetstreamManager();

      console.log('\n=== NatsPubsub Configuration ===');
      const cfg = config.get();
      console.log(`Environment: ${cfg.env}`);
      console.log(`App Name: ${cfg.appName}`);
      console.log(
        `NATS URLs: ${Array.isArray(cfg.natsUrls) ? cfg.natsUrls.join(', ') : cfg.natsUrls}`
      );
      console.log(`Stream Name: ${config.streamName}`);
      console.log(`DLQ Subject: ${config.dlqSubject}`);
      console.log(`Concurrency: ${cfg.concurrency}`);
      console.log(`Max Deliver: ${cfg.maxDeliver}`);
      console.log(`Use DLQ: ${cfg.useDlq}`);

      console.log('\n=== Stream Information ===');
      try {
        const streamInfo = await jsm.streams.info(config.streamName);
        console.log(`Stream: ${streamInfo.config.name}`);
        console.log(`Subjects: ${streamInfo.config.subjects.join(', ')}`);
        console.log(`Messages: ${streamInfo.state.messages}`);
        console.log(`Bytes: ${streamInfo.state.bytes}`);
        console.log(`First Seq: ${streamInfo.state.first_seq}`);
        console.log(`Last Seq: ${streamInfo.state.last_seq}`);
        console.log(`Consumers: ${streamInfo.state.consumer_count}`);
      } catch (error: unknown) {
        const err = error as { code?: string; message?: string };
        if (err.code === '404') {
          console.log(`Stream "${config.streamName}" does not exist yet`);
        } else {
          throw error;
        }
      }

      // Check DLQ stream if configured
      if (cfg.useDlq) {
        console.log('\n=== DLQ Stream Information ===');
        const dlqStreamName = `${config.streamName}-dlq`;
        try {
          const dlqInfo = await jsm.streams.info(dlqStreamName);
          console.log(`Stream: ${dlqInfo.config.name}`);
          console.log(`Subjects: ${dlqInfo.config.subjects.join(', ')}`);
          console.log(`Messages: ${dlqInfo.state.messages}`);
          console.log(`Bytes: ${dlqInfo.state.bytes}`);
        } catch (error: unknown) {
          const err = error as { code?: string };
          if (err.code === '404') {
            console.log(`DLQ stream "${dlqStreamName}" does not exist yet`);
          } else {
            throw error;
          }
        }
      }

      await connection.disconnect();
    } catch (error) {
      console.error('Failed to get info:', error);
      process.exit(1);
    }
  });

/**
 * Health command - Check connection health
 */
program
  .command('health')
  .description('Check connection health')
  .option('-u, --url <url>', 'NATS server URL', 'nats://localhost:4222')
  .action(async (options) => {
    try {
      config.configure({
        natsUrls: options.url,
      });

      console.log('Checking NATS connection...');
      await connection.ensureConnection();
      const nc = connection.getConnection();

      console.log('✓ Connected to NATS');
      console.log(`  Server: ${nc.getServer()}`);
      console.log(`  Status: ${nc.isClosed() ? 'closed' : 'open'}`);

      // Try to access JetStream
      const jsm = await nc.jetstreamManager();
      const accountInfo = await jsm.getAccountInfo();
      console.log('✓ JetStream available');
      console.log(`  Streams: ${accountInfo.streams}`);
      console.log(`  Consumers: ${accountInfo.consumers}`);
      console.log(`  Memory: ${accountInfo.memory} bytes`);
      console.log(`  Storage: ${accountInfo.storage} bytes`);

      await connection.disconnect();
      console.log('\nHealth check passed ✓');
    } catch (error) {
      console.error('Health check failed:', error);
      process.exit(1);
    }
  });

/**
 * Purge command - Purge messages from stream
 */
program
  .command('purge')
  .description('Purge messages from stream')
  .option('-e, --env <env>', 'Environment (default: development)', 'development')
  .option('-a, --app <name>', 'Application name', 'app')
  .option('-u, --url <url>', 'NATS server URL', 'nats://localhost:4222')
  .option('--dlq', 'Purge DLQ stream instead of main stream')
  .option('--force', 'Skip confirmation prompt')
  .action(async (options) => {
    try {
      config.configure({
        env: options.env,
        appName: options.app,
        natsUrls: options.url,
      });

      const streamName = options.dlq ? `${config.streamName}-dlq` : config.streamName;

      if (!options.force) {
        console.log(`WARNING: This will delete all messages from stream: ${streamName}`);
        console.log('Use --force to skip this confirmation');
        process.exit(0);
      }

      await connection.ensureConnection();
      const nc = connection.getConnection();
      const jsm = await nc.jetstreamManager();

      console.log(`Purging stream: ${streamName}...`);
      await jsm.streams.purge(streamName);
      console.log('✓ Stream purged successfully');

      await connection.disconnect();
    } catch (error) {
      console.error('Failed to purge stream:', error);
      process.exit(1);
    }
  });

/**
 * Delete command - Delete stream
 */
program
  .command('delete')
  .description('Delete stream')
  .option('-e, --env <env>', 'Environment (default: development)', 'development')
  .option('-a, --app <name>', 'Application name', 'app')
  .option('-u, --url <url>', 'NATS server URL', 'nats://localhost:4222')
  .option('--dlq', 'Delete DLQ stream instead of main stream')
  .option('--force', 'Skip confirmation prompt')
  .action(async (options) => {
    try {
      config.configure({
        env: options.env,
        appName: options.app,
        natsUrls: options.url,
      });

      const streamName = options.dlq ? `${config.streamName}-dlq` : config.streamName;

      if (!options.force) {
        console.log(`WARNING: This will permanently delete stream: ${streamName}`);
        console.log('Use --force to skip this confirmation');
        process.exit(0);
      }

      await connection.ensureConnection();
      const nc = connection.getConnection();
      const jsm = await nc.jetstreamManager();

      console.log(`Deleting stream: ${streamName}...`);
      await jsm.streams.delete(streamName);
      console.log('✓ Stream deleted successfully');

      await connection.disconnect();
    } catch (error) {
      console.error('Failed to delete stream:', error);
      process.exit(1);
    }
  });

// Parse command-line arguments
program.parse();
