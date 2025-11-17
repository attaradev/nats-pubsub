# NatsPubsub Troubleshooting Guide

Common issues and solutions for NatsPubsub in Rails applications.

## Table of Contents

- [Connection Issues](#connection-issues)
- [Publishing Problems](#publishing-problems)
- [Subscription Issues](#subscription-issues)
- [Performance Issues](#performance-issues)
- [Outbox/Inbox Pattern Issues](#outboxinbox-pattern-issues)
- [Testing Issues](#testing-issues)
- [Deployment Issues](#deployment-issues)

---

## Connection Issues

### Problem: Unable to Connect to NATS

**Symptoms:**

```md
NATS::IO::SocketTimeoutError: nats: timeout
```

**Solutions:**

1. **Check NATS Server is Running:**

   ```bash
   # Check if NATS is running
   curl http://localhost:8222/varz

   # Or with nats-server
   nats server check
   ```

2. **Verify Connection URL:**

   ```ruby
   # Check your configuration
   puts NatsPubsub.config.nats_urls
   # Should be: nats://localhost:4222

   # Test connection manually
   require 'nats/client'
   NATS.connect('nats://localhost:4222')
   ```

3. **Check Firewall/Network:**

   ```bash
   # Test connectivity
   telnet localhost 4222
   nc -zv localhost 4222
   ```

4. **Check Credentials:**

   ```ruby
   # If using authentication
   config.nats_urls = 'nats://username:password@localhost:4222'
   ```

### Problem: Connection Drops Intermittently

**Symptoms:**

```md
NATS client connection closed
```

**Solutions:**

1. **Enable Reconnection:**

   ```ruby
   # Already enabled by default, but verify
   NatsPubsub::Connection::DEFAULT_CONN_OPTS
   # => {reconnect: true, max_reconnect_attempts: 10}
   ```

2. **Check Network Stability:**

   ```bash
   # Monitor connection
   watch -n 1 'netstat -an | grep 4222'
   ```

3. **Increase Timeouts:**

   ```ruby
   # In config/initializers/nats_pubsub.rb
   NatsPubsub.configure do |config|
    config.connection_pool_timeout = 10  # Increase from 5
   end
   ```

### Problem: JetStream Not Available

**Symptoms:**

```md
JetStream not enabled for account
```

**Solutions:**

1. **Enable JetStream in NATS Server:**

   ```bash
   # Start NATS with JetStream
   nats-server -js

   # Or in config file
   # nats-server.conf
   jetstream {
     store_dir: /tmp/nats/jetstream
     max_memory_store: 1GB
     max_file_store: 10GB
   }
   ```

2. **Verify JetStream is Enabled:**

   ```bash
   nats account info
   ```

3. **Check Account Limits:**

   ```bash
   # May need to increase limits
   nats account info
   ```

---

## Publishing Problems

### Problem: Events Not Being Published

**Symptoms:**

- No errors, but subscribers don't receive messages
- Health check shows healthy

**Solutions:**

1. **Check Subject Pattern:**

   ```ruby
   # Verify subject being published to
   NatsPubsub.configure do |config|
     config.env = 'development'
     config.app_name = 'my_app'
   end

   # Subject will be: development.my_app.domain.resource.action
   # Make sure subscriber pattern matches
   ```

2. **Verify Publisher is Called:**

   ```ruby
   # Add logging
   class User < ApplicationRecord
     include NatsPubsub::ActiveRecord::Publishable
     publishes_events domain: 'users', resource: 'user'

     after_commit :log_publish, on: :create
     def log_publish
       Rails.logger.info "Publishing user.created for ID: #{id}"
     end
   end
   ```

3. **Check Transaction Scope:**

   ```ruby
   # Events only publish after transaction commits
   User.transaction do
     user = User.create!(email: 'test@example.com')
     # Event NOT published yet
   end
   # Event published HERE after commit
   ```

4. **Test Directly:**

   ```ruby
   # In rails console
   NatsPubsub.publish('users', 'user', 'test', id: 1)
   # Check logs and subscriber
   ```

### Problem: Outbox Events Stuck in Pending

**Symptoms:**

- Events created in outbox table
- Status stays 'pending'
- No errors in logs

**Solutions:**

1. **Check Background Worker:**

   ```ruby
   # Manually trigger publishing
   NatsPubsub::OutboxPublisher.publish_pending(limit: 100)
   ```

2. **Setup Scheduled Job:**

   ```ruby
   # app/jobs/nats_pubsub_outbox_job.rb
   class NatsPubsubOutboxJob < ApplicationJob
     queue_as :default

     def perform
       NatsPubsub::OutboxPublisher.publish_pending(limit: 100)
     end
   end

   # Schedule every minute
   ```

3. **Check for Stale Events:**

   ```ruby
   # Reset stale publishing events
   repo = NatsPubsub::OutboxRepository.new
   repo.reset_stale_publishing(5.minutes.ago)
   ```

### Problem: Duplicate Events Being Published

**Symptoms:**

- Same event published multiple times
- Subscribers receive duplicates

**Solutions:**

1. **Enable Inbox Pattern:**

   ```bash
   rails generate nats_pubsub:config --inbox
   ```

2. **Check for Multiple Callbacks:**

   ```ruby
   # Make sure you're not calling publish multiple times
   class User < ApplicationRecord
     include NatsPubsub::ActiveRecord::Publishable
     publishes_events domain: 'users', resource: 'user'

     # DON'T also do this:
     # after_commit :manual_publish  # This would duplicate!
   end
   ```

3. **Use Idempotency Keys:**

   ```ruby
   # Publishers automatically use event_id as idempotency key
   # Verify nats-msg-id is being set
   ```

---

## Subscription Issues

### Problem: Subscriber Not Receiving Messages

**Symptoms:**

- Publisher works (messages in outbox/logs)
- Subscriber never processes messages

**Solutions:**

1. **Verify Subscription Pattern:**

   ```ruby
   # Check subject pattern matches
   class UserSubscriber
     include NatsPubsub::Subscriber

     # This pattern
     subscribe_to 'users.user'

     # Will become: {env}.{app}.users.user.*
     # Must match publisher: {env}.{app}.users.user.created
   end
   ```

2. **Check Subscriber is Loaded:**

   ```ruby
   # In rails console
   NatsPubsub::Subscribers::Registry.instance.all_subscribers
   # Should include your subscriber

   # If not, make sure it's required
   # config/application.rb
   config.eager_load_paths += %W[#{config.root}/app/subscribers]
   ```

3. **Verify Consumer Exists:**

   ```bash
   nats consumer list {stream-name}
   ```

4. **Check Filter Subject:**

   ```ruby
   # Debug subscription
   subscriber = UserSubscriber.new
   puts subscriber.class.all_subscriptions
   ```

### Problem: Messages Being NACK'd Repeatedly

**Symptoms:**

```md
[NatsPubsub::Subscribers::MessageProcessor] NAK (retry) event_id=...
```

**Solutions:**

1. **Check Handler for Errors:**

   ```ruby
   class UserSubscriber
     def handle(message, context)
       # Add error handling
       Rails.logger.info "Processing: #{context.event_id}"

       # Your code
     rescue StandardError => e
       Rails.logger.error "Handler error: #{e.message}"
       Rails.logger.error e.backtrace.join("\n")
       raise # Re-raise for retry
     end
   end
   ```

2. **Increase Retries:**

   ```ruby
   class UserSubscriber
     jetstream_options retry: 10, ack_wait: 60
   end
   ```

3. **Use Custom Error Handling:**

   ```ruby
   class UserSubscriber
     def on_error(error_context)
       case error_context.error
       when ActiveRecord::RecordNotFound
         # Discard - record doesn't exist
         NatsPubsub::Core::ErrorAction::DISCARD
       when Timeout::Error
         # Retry - temporary issue
         NatsPubsub::Core::ErrorAction::RETRY
       else
         # DLQ - unknown error
         NatsPubsub::Core::ErrorAction::DLQ
       end
     end
   end
   ```

### Problem: Slow Message Processing

**Symptoms:**

- Messages queue up
- Processing takes too long
- Memory usage increases

**Solutions:**

1. **Increase Concurrency:**

   ```ruby
   # config/initializers/nats_pubsub.rb
   NatsPubsub.configure do |config|
     config.concurrency = 20  # Increase from default 5
   end
   ```

2. **Optimize Handler:**

   ```ruby
   class UserSubscriber
     def handle(message, context)
       # DON'T do expensive sync operations
       # send_email(user)  # Bad

       # DO use background jobs
       UserMailer.welcome_email(user.id).deliver_later  # Good

       # DO batch operations
       User.where(id: user_ids).update_all(processed: true)  # Good
     end
   end
   ```

3. **Add Instrumentation:**

   ```ruby
   ActiveSupport::Notifications.subscribe('nats_pubsub.process') do |*args|
     event = ActiveSupport::Notifications::Event.new(*args)
     if event.duration > 1000
       Rails.logger.warn "Slow processing: #{event.duration}ms"
     end
   end
   ```

---

## Performance Issues

### Problem: High Memory Usage

**Symptoms:**

- Memory grows over time
- OOM errors
- Slow performance

**Solutions:**

1. **Reduce Batch Size:**

   ```ruby
   class UserSubscriber
     jetstream_options batch_size: 10  # Reduce from 25
   end
   ```

2. **Process in Batches:**

   ```ruby
   def handle(message, context)
     # Instead of loading all
     # users = User.where(status: 'pending')

     # Process in batches
     User.where(status: 'pending').find_each(batch_size: 100) do |user|
       process_user(user)
     end
   end
   ```

3. **Clear Objects:**

   ```ruby
   def handle(message, context)
     heavy_object = nil
     begin
       heavy_object = process_message(message)
     ensure
       heavy_object = nil
       GC.start if Time.now - @last_gc > 60
     end
   end
   ```

### Problem: Database Connection Pool Exhausted

**Symptoms:**

```md
ActiveRecord::ConnectionTimeoutError: could not obtain a database connection
```

**Solutions:**

1. **Increase Pool Size:**

   ```yaml
   # config/database.yml
   production:
     adapter: postgresql
     pool: <%= ENV.fetch("RAILS_MAX_THREADS") { 20 } %>
   ```

2. **Release Connections:**

   ```ruby
   def handle(message, context)
     ActiveRecord::Base.connection_pool.with_connection do
       # Your code here
     end
   end
   ```

3. **Reduce Concurrency:**

   ```ruby
   # Match or be less than DB pool size
   config.concurrency = 15  # If DB pool is 20
   ```

---

## Outbox/Inbox Pattern Issues

### Problem: Outbox Table Growing Too Large

**Symptoms:**

- Millions of rows in outbox table
- Slow queries
- Disk space issues

**Solutions:**

1. **Setup Cleanup Job:**

   ```ruby
   # app/jobs/nats_pubsub_cleanup_job.rb
   class NatsPubsubCleanupJob < ApplicationJob
     def perform
       repo = NatsPubsub::OutboxRepository.new

       # Delete sent events older than 7 days
       deleted = repo.cleanup_sent_events(7.days.ago)
       Rails.logger.info "Cleaned up #{deleted} outbox events"
     end
   end

   # Run daily
   ```

2. **Add Database Indexes:**

   ```ruby
   # db/migrate/xxx_add_outbox_cleanup_indexes.rb
   class AddOutboxCleanupIndexes < ActiveRecord::Migration[7.0]
     def change
       add_index :nats_pubsub_outbox, [:status, :sent_at]
       add_index :nats_pubsub_outbox, [:status, :updated_at]
     end
   end
   ```

3. **Partition Table (PostgreSQL):**

   ```sql
   -- Partition by month
   CREATE TABLE nats_pubsub_outbox_y2025m01
     PARTITION OF nats_pubsub_outbox
     FOR VALUES FROM ('2025-01-01') TO ('2025-02-01');
   ```

### Problem: Inbox Duplicates Not Being Detected

**Symptoms:**

- Same event processed multiple times
- Duplicate entries created

**Solutions:**

1. **Verify event_id is Unique:**

   ```ruby
   # Check inbox model
   NatsPubsub::InboxEvent.where(event_id: 'some-id').count
   # Should be 0 or 1
   ```

2. **Check Database Constraint:**

   ```bash
   rails db:migrate:status
   # Verify inbox migration ran
   ```

3. **Add Validation:**

   ```ruby
   class NatsPubsub::InboxEvent
     validates :event_id, uniqueness: true
   end
   ```

---

## Testing Issues

### Problem: Tests Failing with Connection Errors

**Symptoms:**

```md
NATS connection error in tests
```

**Solutions:**

1. **Use Test Mode:**

   ```ruby
   # spec/rails_helper.rb
   require 'nats_pubsub/testing/helpers'

   RSpec.configure do |config|
     NatsPubsub::Testing::RSpecConfiguration.configure(config)
   end
   ```

2. **Use Fake Mode:**

   ```ruby
   # In specific tests
   RSpec.describe User, nats_fake: true do
     # Tests here won't connect to NATS
   end
   ```

3. **Stub Connection:**

   ```ruby
   before do
     stub_nats_connection
   end
   ```

### Problem: Events Not Recorded in Tests

**Symptoms:**

- `have_published_event` matcher fails
- `last_nats_event` is nil

**Solutions:**

1. **Enable Fake Mode:**

   ```ruby
   # Must use nats_fake: true
   RSpec.describe User, nats_fake: true do
     it 'publishes event' do
       expect { User.create! }.to have_published_event
     end
   end
   ```

2. **Manually Enable:**

   ```ruby
   before do
     NatsPubsub::Testing.fake!
   end

   after do
     NatsPubsub::Testing.clear!
   end
   ```

---

## Deployment Issues

### Problem: Works Locally, Fails in Production

**Symptoms:**

- Everything works in development
- Production shows errors

**Common Causes & Solutions:**

1. **Environment Variables Not Set:**

   ```bash
   # Verify on production
   echo $NATS_URLS
   echo $NATS_ENV
   echo $APP_NAME

   # Set in production
   export NATS_URLS=nats://prod-nats:4222
   export NATS_ENV=production
   export APP_NAME=my_app
   ```

2. **Firewall Blocking:**

   ```bash
   # Test from production server
   telnet prod-nats 4222
   ```

3. **Eager Loading Issues:**

   ```ruby
   # config/environments/production.rb
   config.eager_load = true

   # Verify subscribers are loaded
   # config/application.rb
   config.eager_load_paths += %W[#{config.root}/app/subscribers]
   ```

4. **Database Migrations:**

   ```bash
   # Verify migrations ran
   rails db:migrate:status
   ```

### Problem: High Latency in Production

**Symptoms:**

- Slow message publishing
- Slow processing

**Solutions:**

1. **Check Network Latency:**

   ```bash
   ping prod-nats
   mtr prod-nats
   ```

2. **Use Local NATS:**
   - Deploy NATS sidecar in Kubernetes
   - Use NATS cluster in same region/datacenter

3. **Enable Connection Pooling:**

   ```ruby
   config.connection_pool_size = 20
   ```

4. **Tune JetStream:**

   ```bash
   # Check JetStream performance
   nats stream info {stream-name}
   ```

---

## Diagnostic Commands

### Check Health

```ruby
# Rails console
result = NatsPubsub::Core::HealthCheck.check
puts result.to_json

# Or via HTTP
curl http://localhost:3000/nats-health
```

### View Outbox Status

```ruby
# Rails console
model = NatsPubsub.config.outbox_model.constantize

puts "Pending: #{model.pending.count}"
puts "Failed: #{model.failed.count}"
puts "Stale: #{model.stale_publishing(5.minutes.ago).count}"

# View failed events
model.failed.limit(10).each do |event|
  puts "#{event.subject}: #{event.last_error}"
end
```

### View Inbox Status

```ruby
model = NatsPubsub.config.inbox_model.constantize

puts "Unprocessed: #{model.unprocessed.count}"
puts "Failed: #{model.failed.count}"

# View failed events
model.failed.limit(10).each do |event|
  puts "#{event.subject}: #{event.error_message}"
end
```

### Check Subscribers

```ruby
NatsPubsub::Subscribers::Registry.instance.all_subscribers.each do |sub|
  puts sub.name
  puts "  Subjects: #{sub.all_subscriptions.map { |s| s[:pattern] }}"
end
```

### View Metrics

```ruby
# If metrics collector is running
collector = NatsPubsub::Instrumentation::MetricsCollector.new
collector.start
# ... wait ...
puts collector.summary
```

---

## Getting Help

### Enable Debug Logging

```ruby
# config/initializers/nats_pubsub.rb
NatsPubsub.configure do |config|
  config.logger = Logger.new(STDOUT)
  config.logger.level = Logger::DEBUG
end
```

### Collect Diagnostics

```ruby
# Create diagnostics report
diagnostics = {
  config: {
    env: NatsPubsub.config.env,
    app_name: NatsPubsub.config.app_name,
    use_outbox: NatsPubsub.config.use_outbox,
    use_inbox: NatsPubsub.config.use_inbox,
    concurrency: NatsPubsub.config.concurrency
  },
  health: NatsPubsub::Core::HealthCheck.check.to_h,
  subscribers: NatsPubsub::Subscribers::Registry.instance.all_subscribers.map(&:name),
  versions: {
    ruby: RUBY_VERSION,
    rails: Rails.version,
    nats_pubsub: NatsPubsub::VERSION
  }
}

puts JSON.pretty_generate(diagnostics)
```

### Report Issues

When reporting issues, include:

1. Ruby version
2. Rails version
3. NatsPubsub version
4. NATS server version
5. Diagnostics output
6. Relevant logs
7. Steps to reproduce

---

**Need More Help?**

- GitHub Issues: <https://github.com/anthropics/nats-pubsub/issues>
- Documentation: [README.md](../../README.md)
- Quick Start: [RAILS_QUICK_START.md](./RAILS_QUICK_START.md)

**Version:** 0.2.1+
**Last Updated:** November 17, 2025
