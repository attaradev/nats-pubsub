# frozen_string_literal: true

require 'json'
require 'time'

module NatsPubsub
  module Core
    # Structured logger for machine-parseable JSON logs
    # Provides consistent logging format with correlation IDs and metadata
    class StructuredLogger
      LEVELS = {
        debug: 0,
        info: 1,
        warn: 2,
        error: 3,
        fatal: 4
      }.freeze

      attr_reader :output, :level, :context

      # Initialize a new structured logger
      #
      # @param output [IO] Output stream (default: $stdout)
      # @param level [Symbol] Log level (:debug, :info, :warn, :error, :fatal)
      # @param context [Hash] Base context included in all log entries
      def initialize(output: $stdout, level: :info, context: {})
        @output = output
        @level = normalize_level(level)
        @context = context.transform_keys(&:to_s)
      end

      # Log at debug level
      def debug(message, metadata = {})
        log(:debug, message, metadata)
      end

      # Log at info level
      def info(message, metadata = {})
        log(:info, message, metadata)
      end

      # Log at warn level
      def warn(message, metadata = {})
        log(:warn, message, metadata)
      end

      # Log at error level
      def error(message, metadata = {})
        log(:error, message, metadata)
      end

      # Log at fatal level
      def fatal(message, metadata = {})
        log(:fatal, message, metadata)
      end

      # Create child logger with additional context
      #
      # @param child_context [Hash] Additional context
      # @return [StructuredLogger] New logger with merged context
      def with_context(child_context)
        self.class.new(
          output: output,
          level: level,
          context: context.merge(child_context.transform_keys(&:to_s))
        )
      end

      private

      # Log a message
      def log(severity, message, metadata)
        return if LEVELS[severity] < LEVELS[level]

        log_entry = build_log_entry(severity, message, metadata)
        output.puts(JSON.generate(log_entry))
        output.flush
      rescue StandardError => e
        # Fallback to plain text if JSON fails
        output.puts("[#{severity}] #{message} | Error: #{e.message}")
        output.flush
      end

      # Build structured log entry
      def build_log_entry(severity, message, metadata)
        {
          timestamp: Time.now.utc.iso8601(3),
          level: severity.to_s.upcase,
          message: message,
          pid: Process.pid,
          thread_id: Thread.current.object_id
        }.merge(context)
         .merge(normalize_metadata(metadata))
      end

      # Normalize metadata keys to strings
      def normalize_metadata(metadata)
        return {} unless metadata.is_a?(Hash)

        metadata.transform_keys(&:to_s)
      end

      # Normalize log level
      def normalize_level(lvl)
        lvl = lvl.to_sym if lvl.is_a?(String)
        return lvl if LEVELS.key?(lvl)

        :info
      end
    end

    # Logger factory for creating structured loggers
    module LoggerFactory
      # Create a structured logger from configuration
      #
      # @param config [Config] Application configuration
      # @return [StructuredLogger] Configured logger
      def self.create_from_config(config)
        level = config.logger&.level || :info

        StructuredLogger.new(
          output: $stdout,
          level: level,
          context: {
            app_name: config.app_name,
            env: config.env
          }
        )
      end

      # Create a logger for a specific component
      #
      # @param component [String] Component name
      # @param config [Config] Application configuration
      # @return [StructuredLogger] Logger with component context
      def self.for_component(component, config)
        create_from_config(config).with_context(component: component)
      end
    end
  end
end
