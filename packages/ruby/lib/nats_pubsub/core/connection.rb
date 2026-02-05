# frozen_string_literal: true

require 'nats/io/client'
require 'singleton'
require 'oj'
require_relative 'duration'
require_relative 'logging'
require_relative 'config'
require_relative '../topology/topology'

module NatsPubsub
  # Singleton connection to NATS.
  class Connection
    include Singleton

    DEFAULT_CONN_OPTS = {
      reconnect: true,
      reconnect_time_wait: 2,
      max_reconnect_attempts: -1,
      connect_timeout: 5
    }.freeze

    class << self
      # Thread-safe delegator to the singleton instance.
      # Returns a live JetStream context.
      def connect!
        @__mutex ||= Mutex.new
        @__mutex.synchronize { instance.connect! }
      end

      # Optional accessors if callers need raw handles
      def nc
        instance.__send__(:nc)
      end

      def jetstream
        instance.__send__(:jetstream)
      end
    end

    # Idempotent: returns an existing, healthy JetStream context or establishes one.
    # NOTE: This method only establishes the connection. Topology setup is separate.
    # Call NatsPubsub.ensure_topology! explicitly after connection if needed.
    def connect!
      return @jts if connected?

      servers = nats_servers
      raise ConfigurationError, 'No NATS URLs configured' if servers.empty?

      establish_connection(servers)

      Logging.info(
        "Connected to NATS (#{servers.size} server#{'s' unless servers.size == 1}): " \
        "#{sanitize_urls(servers).join(', ')}",
        tag: 'NatsPubsub::Connection'
      )

      @jts
    end

    private

    def connected?
      @nc&.connected?
    end

    def nats_servers
      NatsPubsub.config.nats_urls
                .to_s
                .split(',')
                .map(&:strip)
                .reject(&:empty?)
    end

    def establish_connection(servers)
      @nc = NATS::IO::Client.new
      conn_opts = { servers: servers }.merge(DEFAULT_CONN_OPTS)
      conn_opts.merge!(build_auth_options)
      conn_opts.merge!(build_tls_options)
      @nc.connect(conn_opts)

      # Create JetStream context
      @jts = @nc.jetstream

      # --- Compatibility shim: ensure JetStream responds to #nc for older/newer clients ---
      return if @jts.respond_to?(:nc)

      nc_ref = @nc
      @jts.define_singleton_method(:nc) { nc_ref }
    end

    # Build authentication options from config
    def build_auth_options
      cfg = NatsPubsub.config
      opts = {}

      if cfg.user_credentials
        opts[:user_credentials] = cfg.user_credentials
      elsif cfg.nkeys_seed
        opts[:nkeys_seed] = cfg.nkeys_seed
      elsif cfg.auth_token
        opts[:auth_token] = cfg.auth_token
      elsif cfg.auth_user && cfg.auth_password
        opts[:user] = cfg.auth_user
        opts[:pass] = cfg.auth_password
      end

      opts
    end

    # Build TLS options from config
    def build_tls_options
      cfg = NatsPubsub.config
      return {} unless cfg.tls_ca_file || cfg.tls_cert_file

      require 'openssl'
      tls_context = OpenSSL::SSL::SSLContext.new
      tls_context.verify_mode = OpenSSL::SSL::VERIFY_PEER

      if cfg.tls_ca_file
        tls_context.ca_file = cfg.tls_ca_file
      end

      if cfg.tls_cert_file && cfg.tls_key_file
        tls_context.cert = OpenSSL::X509::Certificate.new(File.read(cfg.tls_cert_file))
        tls_context.key = OpenSSL::PKey.read(File.read(cfg.tls_key_file))
      end

      { tls: { context: tls_context } }
    end

    # Expose for class-level helpers (not part of public API)
    attr_reader :nc

    def jetstream
      @jts
    end

    # Mask credentials in NATS URLs:
    # - "nats://user:pass@host:4222" -> "nats://user:***@host:4222"
    # - "nats://token@host:4222"     -> "nats://***@host:4222"
    def sanitize_urls(urls)
      urls.map { |u| Logging.sanitize_url(u) }
    end
  end
end
