# frozen_string_literal: true

module NatsPubsub
  module Core
    # Health check for NatsPubsub components
    #
    # Provides comprehensive health checking for connection, JetStream, and streams.
    #
    # @example Basic health check
    #   status = NatsPubsub::Core::HealthCheck.check
    #   puts "Status: #{status.status}"
    #   puts "Healthy: #{status.healthy?}"
    #
    # @example Quick health check
    #   status = NatsPubsub::Core::HealthCheck.quick_check
    #   puts "Status: #{status.status}"
    #
    class HealthCheck
      # Health check result
      #
      # @!attribute [r] status
      #   @return [Symbol] Overall status (:healthy, :degraded, :unhealthy)
      # @!attribute [r] components
      #   @return [Hash] Component health details
      # @!attribute [r] timestamp
      #   @return [Time] Check timestamp
      # @!attribute [r] duration
      #   @return [Float] Check duration in milliseconds
      #
      class Result
        attr_reader :status, :components, :timestamp, :duration

        def initialize(status:, components:, timestamp:, duration:)
          @status = status
          @components = components
          @timestamp = timestamp
          @duration = duration
          freeze
        end

        # Check if system is healthy
        #
        # @return [Boolean] True if healthy
        def healthy?
          status == :healthy
        end

        # Check if system is degraded
        #
        # @return [Boolean] True if degraded
        def degraded?
          status == :degraded
        end

        # Check if system is unhealthy
        #
        # @return [Boolean] True if unhealthy
        def unhealthy?
          status == :unhealthy
        end

        # Convert to hash
        #
        # @return [Hash] Hash representation
        def to_h
          {
            status: status,
            healthy: healthy?,
            components: components,
            timestamp: timestamp.iso8601,
            duration_ms: duration
          }
        end

        alias to_hash to_h

        # Convert to JSON
        #
        # @return [String] JSON string
        def to_json(*_args)
          require 'json'
          to_h.to_json
        end
      end

      # Component health details
      #
      # @!attribute [r] status
      #   @return [Symbol] Component status (:healthy, :unhealthy)
      # @!attribute [r] message
      #   @return [String, nil] Status message
      # @!attribute [r] details
      #   @return [Hash, nil] Additional details
      #
      class ComponentHealth
        attr_reader :status, :message, :details

        def initialize(status:, message: nil, details: nil)
          @status = status
          @message = message
          @details = details
          freeze
        end

        def healthy?
          status == :healthy
        end

        def unhealthy?
          status == :unhealthy
        end

        def to_h
          {
            status: status,
            healthy: healthy?,
            message: message,
            details: details
          }.compact
        end

        alias to_hash to_h
      end

      class << self
        # Perform comprehensive health check
        #
        # Checks:
        # - NATS connection
        # - JetStream availability
        # - Stream configuration
        # - Outbox pattern (if enabled)
        # - Inbox pattern (if enabled)
        # - Connection pool
        #
        # @return [Result] Health check result
        def check
          start_time = Time.now
          components = {}

          # Check NATS connection
          components[:connection] = check_connection

          # Check JetStream
          components[:jetstream] = check_jetstream

          # Check streams
          components[:streams] = check_streams if components[:jetstream].healthy?

          # Check outbox (if enabled)
          outbox_health = check_outbox
          components[:outbox] = outbox_health if outbox_health

          # Check inbox (if enabled)
          inbox_health = check_inbox
          components[:inbox] = inbox_health if inbox_health

          # Check connection pool
          components[:connection_pool] = check_connection_pool

          # Determine overall status
          status = determine_status(components)

          duration = ((Time.now - start_time) * 1000).round(2)

          Result.new(
            status: status,
            components: components.transform_values(&:to_h),
            timestamp: Time.now,
            duration: duration
          )
        rescue StandardError => e
          Result.new(
            status: :unhealthy,
            components: {
              error: ComponentHealth.new(
                status: :unhealthy,
                message: "Health check failed: #{e.message}"
              ).to_h
            },
            timestamp: Time.now,
            duration: ((Time.now - start_time) * 1000).round(2)
          )
        end

        # Perform quick health check
        #
        # Only checks NATS connection for fast response.
        #
        # @return [Result] Health check result
        def quick_check
          start_time = Time.now

          connection_health = check_connection

          Result.new(
            status: connection_health.healthy? ? :healthy : :unhealthy,
            components: { connection: connection_health.to_h },
            timestamp: Time.now,
            duration: ((Time.now - start_time) * 1000).round(2)
          )
        rescue StandardError => e
          Result.new(
            status: :unhealthy,
            components: {
              error: ComponentHealth.new(
                status: :unhealthy,
                message: "Quick check failed: #{e.message}"
              ).to_h
            },
            timestamp: Time.now,
            duration: ((Time.now - start_time) * 1000).round(2)
          )
        end

        # Rack middleware for health check endpoint
        #
        # @example Sinatra
        #   get '/health' do
        #     status, headers, body = NatsPubsub::Core::HealthCheck.middleware.call(env)
        #     [status, headers, body]
        #   end
        #
        # @example Rails
        #   get '/health', to: proc { |env|
        #     NatsPubsub::Core::HealthCheck.middleware.call(env)
        #   }
        #
        # @return [Proc] Rack middleware
        def middleware
          lambda do |_env|
            result = check
            status_code = result.healthy? ? 200 : (result.degraded? ? 200 : 503)

            [
              status_code,
              { 'Content-Type' => 'application/json' },
              [result.to_json]
            ]
          end
        end

        # Rack middleware for quick health check endpoint
        #
        # @return [Proc] Rack middleware
        def quick_middleware
          lambda do |_env|
            result = quick_check
            status_code = result.healthy? ? 200 : 503

            [
              status_code,
              { 'Content-Type' => 'application/json' },
              [result.to_json]
            ]
          end
        end

        private

        # Check NATS connection
        #
        # @return [ComponentHealth] Connection health
        def check_connection
          nc = Connection.connection
          return ComponentHealth.new(status: :unhealthy, message: 'Not connected') if nc.nil?

          if nc.closed?
            ComponentHealth.new(status: :unhealthy, message: 'Connection closed')
          else
            ComponentHealth.new(
              status: :healthy,
              message: 'Connected',
              details: {
                server_info: nc.server_info.to_h
              }
            )
          end
        rescue StandardError => e
          ComponentHealth.new(
            status: :unhealthy,
            message: "Connection check failed: #{e.message}"
          )
        end

        # Check JetStream availability
        #
        # @return [ComponentHealth] JetStream health
        def check_jetstream
          nc = Connection.connection
          return ComponentHealth.new(status: :unhealthy, message: 'Not connected') if nc.nil?

          jsm = nc.jetstream_manager
          account_info = jsm.account_info

          ComponentHealth.new(
            status: :healthy,
            message: 'JetStream available',
            details: {
              streams: account_info.streams,
              consumers: account_info.consumers,
              memory: account_info.memory,
              storage: account_info.storage
            }
          )
        rescue StandardError => e
          ComponentHealth.new(
            status: :unhealthy,
            message: "JetStream check failed: #{e.message}"
          )
        end

        # Check configured streams
        #
        # @return [ComponentHealth] Streams health
        def check_streams
          nc = Connection.connection
          jsm = nc.jetstream_manager

          # Get configured stream names from topology
          expected_streams = Topology.stream_configs.keys

          existing_streams = jsm.streams.map(&:config).map(&:name)

          missing_streams = expected_streams - existing_streams

          if missing_streams.empty?
            ComponentHealth.new(
              status: :healthy,
              message: 'All streams configured',
              details: {
                expected: expected_streams.size,
                existing: existing_streams.size,
                streams: existing_streams
              }
            )
          else
            ComponentHealth.new(
              status: :unhealthy,
              message: 'Missing streams',
              details: {
                expected: expected_streams.size,
                existing: existing_streams.size,
                missing: missing_streams
              }
            )
          end
        rescue StandardError => e
          ComponentHealth.new(
            status: :unhealthy,
            message: "Streams check failed: #{e.message}"
          )
        end

        # Check outbox health (if enabled)
        #
        # @return [ComponentHealth, nil] Outbox health or nil if disabled
        def check_outbox
          return nil unless NatsPubsub.config.use_outbox

          model = NatsPubsub.config.outbox_model.constantize

          pending_count = model.pending.count
          failed_count = model.failed.count
          stale_count = model.stale_publishing(5.minutes.ago).count

          status = if stale_count > 0 || failed_count > 100
                     :unhealthy
                   elsif pending_count > 1000
                     :degraded
                   else
                     :healthy
                   end

          ComponentHealth.new(
            status: status,
            message: 'Outbox operational',
            details: {
              pending: pending_count,
              failed: failed_count,
              stale: stale_count
            }
          )
        rescue StandardError => e
          ComponentHealth.new(
            status: :unhealthy,
            message: "Outbox check failed: #{e.message}"
          )
        end

        # Check inbox health (if enabled)
        #
        # @return [ComponentHealth, nil] Inbox health or nil if disabled
        def check_inbox
          return nil unless NatsPubsub.config.use_inbox

          model = NatsPubsub.config.inbox_model.constantize

          unprocessed_count = model.unprocessed.count
          failed_count = model.failed.count

          status = if failed_count > 100
                     :unhealthy
                   elsif unprocessed_count > 1000
                     :degraded
                   else
                     :healthy
                   end

          ComponentHealth.new(
            status: status,
            message: 'Inbox operational',
            details: {
              unprocessed: unprocessed_count,
              failed: failed_count
            }
          )
        rescue StandardError => e
          ComponentHealth.new(
            status: :unhealthy,
            message: "Inbox check failed: #{e.message}"
          )
        end

        # Check connection pool health
        #
        # @return [ComponentHealth] Connection pool health
        def check_connection_pool
          config = NatsPubsub.config

          ComponentHealth.new(
            status: :healthy,
            message: 'Connection pool configured',
            details: {
              pool_size: config.connection_pool_size,
              pool_timeout: config.connection_pool_timeout
            }
          )
        rescue StandardError => e
          ComponentHealth.new(
            status: :unhealthy,
            message: "Connection pool check failed: #{e.message}"
          )
        end

        # Determine overall status from components
        #
        # @param components [Hash] Component health map
        # @return [Symbol] Overall status
        def determine_status(components)
          statuses = components.values.map(&:status)

          if statuses.all? { |s| s == :healthy }
            :healthy
          elsif statuses.any? { |s| s == :unhealthy }
            # If connection or jetstream is unhealthy, system is unhealthy
            if components[:connection]&.unhealthy? || components[:jetstream]&.unhealthy?
              :unhealthy
            else
              # Otherwise degraded
              :degraded
            end
          else
            :degraded
          end
        end
      end
    end
  end
end
