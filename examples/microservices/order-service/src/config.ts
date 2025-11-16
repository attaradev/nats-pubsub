export default {
  env: process.env.NODE_ENV || 'development',
  port: parseInt(process.env.PORT || '3001', 10),
  natsUrls: process.env.NATS_URLS || 'nats://localhost:4222',
  databaseUrl: process.env.DATABASE_URL || 'postgres://postgres:postgres@localhost:5432/orders',
  appName: process.env.APP_NAME || 'order-service',
};
