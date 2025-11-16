# frozen_string_literal: true

require_relative 'core/logging'
require_relative 'subscribers/registry'

module NatsPubsub
  # CLI for running NatsPubsub subscribers
  class CLI
    def initialize(options = {})
      @options = options
      @pool = nil
      @running = true
    end

    def run
      setup_environment
      setup_signal_handlers
      discover_subscribers
      start_pool
      wait_for_shutdown
    end

    private

    def setup_environment
      ENV['RAILS_ENV'] = ENV['RACK_ENV'] = @options[:environment] if @options[:environment]

      if @options[:require]
        require File.expand_path(@options[:require])
      elsif File.exist?('config/environment.rb')
        require File.expand_path('config/environment.rb')
      else
        raise 'Cannot find application. Use -r to specify file to require.'
      end

      Logging.info(
        "NatsPubsub starting in #{@options[:environment] || ENV['RAILS_ENV'] || 'development'} environment",
        tag: 'NatsPubsub::CLI'
      )
    end

    def discover_subscribers
      Subscribers::Registry.instance.discover_subscribers!

      subscribers = Subscribers::Registry.instance.all_subscribers
      return unless subscribers.empty?

      Logging.warn(
        'No subscribers found in app/subscribers/',
        tag: 'NatsPubsub::CLI'
      )
      exit(1)
    end

    def start_pool
      # Load Pool (lazy load to avoid circular dependencies)
      require_relative 'subscribers/pool'

      concurrency = @options[:concurrency] || NatsPubsub.config.concurrency || 5
      @pool = Subscribers::Pool.new(concurrency: concurrency)

      Thread.new do
        @pool.start!
      end
    end

    def setup_signal_handlers
      %w[INT TERM].each do |signal|
        trap(signal) do
          Logging.info(
            "Received #{signal}, shutting down gracefully...",
            tag: 'NatsPubsub::CLI'
          )
          @running = false
          @pool&.stop!
        end
      end

      trap('USR1') do
        Logging.info('Thread dump:', tag: 'NatsPubsub::CLI')
        Thread.list.each do |thread|
          Logging.info(
            "#{thread.name || thread.object_id}: #{thread.status}",
            tag: 'NatsPubsub::CLI'
          )
        end
      end
    rescue ArgumentError => e
      # Some systems don't support USR1
      Logging.warn("Could not setup USR1 signal handler: #{e.message}", tag: 'NatsPubsub::CLI')
    end

    def wait_for_shutdown
      sleep 0.5 while @running

      Logging.info(
        'Waiting for in-flight messages to complete...',
        tag: 'NatsPubsub::CLI'
      )
      sleep 2

      Logging.info('Shutdown complete', tag: 'NatsPubsub::CLI')
    end
  end
end
