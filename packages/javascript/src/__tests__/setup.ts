import config from '../core/config';

// Initialize config before any tests run
// This ensures the Publisher singleton can be created safely
config.configure({
  natsUrls: 'nats://localhost:4222',
  env: 'test',
  appName: 'test-app',
});
