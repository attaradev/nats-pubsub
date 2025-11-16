export default {
  env: process.env.NODE_ENV || 'development',
  port: parseInt(process.env.PORT || '3002', 10),
  natsUrls: process.env.NATS_URLS || 'nats://localhost:4222',
  appName: process.env.APP_NAME || 'email-service',
  smtp: {
    host: process.env.SMTP_HOST || 'localhost',
    port: parseInt(process.env.SMTP_PORT || '1025', 10), // Default to Mailhog port
    secure: false,
    auth: process.env.SMTP_USER
      ? {
          user: process.env.SMTP_USER,
          pass: process.env.SMTP_PASSWORD || '',
        }
      : undefined,
    from: process.env.SMTP_FROM || 'noreply@example.com',
  },
};
