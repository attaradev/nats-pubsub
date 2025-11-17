# frozen_string_literal: true

module NatsPubsub
  module Rails
    # Rails helper for NatsPubsub health check endpoints
    #
    # Provides easy integration with Rails routing and controllers.
    #
    # @example Rails routes
    #   # config/routes.rb
    #   require 'nats_pubsub/rails/health_endpoint'
    #
    #   Rails.application.routes.draw do
    #     mount NatsPubsub::Rails::HealthEndpoint => '/nats-health'
    #
    #     # Or use individual endpoints
    #     get '/health/nats', to: NatsPubsub::Rails::HealthEndpoint.full_check
    #     get '/health/nats/quick', to: NatsPubsub::Rails::HealthEndpoint.quick_check
    #     get '/health/nats/liveness', to: NatsPubsub::Rails::HealthEndpoint.liveness
    #     get '/health/nats/readiness', to: NatsPubsub::Rails::HealthEndpoint.readiness
    #   end
    #
    # @example Controller action
    #   class HealthController < ApplicationController
    #     def nats
    #       render json: NatsPubsub::Rails::HealthEndpoint.check_health
    #     end
    #   end
    #
    class HealthEndpoint
      # Rack application for health check endpoints
      #
      # Supports multiple endpoints:
      # - GET / - Full health check
      # - GET /quick - Quick connection check
      # - GET /liveness - Liveness probe (always returns 200 if app is running)
      # - GET /readiness - Readiness probe (checks if ready to accept traffic)
      #
      # @param env [Hash] Rack environment
      # @return [Array] Rack response [status, headers, body]
      def self.call(env)
        request = ::Rack::Request.new(env)

        case request.path_info
        when '/', ''
          full_check.call(env)
        when '/quick'
          quick_check.call(env)
        when '/liveness'
          liveness.call(env)
        when '/readiness'
          readiness.call(env)
        else
          not_found
        end
      end

      # Full health check endpoint
      #
      # @return [Proc] Rack endpoint
      def self.full_check
        lambda do |_env|
          result = Core::HealthCheck.check
          status_code = http_status_for_health(result)

          [
            status_code,
            { 'Content-Type' => 'application/json' },
            [result.to_json]
          ]
        end
      end

      # Quick health check endpoint (connection only)
      #
      # @return [Proc] Rack endpoint
      def self.quick_check
        lambda do |_env|
          result = Core::HealthCheck.quick_check
          status_code = result.healthy? ? 200 : 503

          [
            status_code,
            { 'Content-Type' => 'application/json' },
            [result.to_json]
          ]
        end
      end

      # Liveness probe endpoint (Kubernetes-style)
      #
      # Always returns 200 if the application is running.
      # Used to determine if the application should be restarted.
      #
      # @return [Proc] Rack endpoint
      def self.liveness
        lambda do |_env|
          response = {
            status: 'alive',
            timestamp: Time.now.iso8601
          }

          [
            200,
            { 'Content-Type' => 'application/json' },
            [response.to_json]
          ]
        end
      end

      # Readiness probe endpoint (Kubernetes-style)
      #
      # Returns 200 if the application is ready to accept traffic.
      # Checks NATS connection and basic connectivity.
      #
      # @return [Proc] Rack endpoint
      def self.readiness
        lambda do |_env|
          result = Core::HealthCheck.quick_check

          response = {
            status: result.healthy? ? 'ready' : 'not_ready',
            healthy: result.healthy?,
            components: result.components,
            timestamp: Time.now.iso8601
          }

          status_code = result.healthy? ? 200 : 503

          [
            status_code,
            { 'Content-Type' => 'application/json' },
            [response.to_json]
          ]
        end
      end

      # Check health and return hash (for controller use)
      #
      # @return [Hash] Health check result
      def self.check_health
        Core::HealthCheck.check.to_h
      end

      # Check quick health and return hash (for controller use)
      #
      # @return [Hash] Quick health check result
      def self.quick_health
        Core::HealthCheck.quick_check.to_h
      end

      # Helper for Rails controller
      #
      # @example
      #   class HealthController < ApplicationController
      #     include NatsPubsub::Rails::HealthEndpoint::ControllerHelper
      #
      #     def nats
      #       render_nats_health
      #     end
      #
      #     def nats_quick
      #       render_nats_health_quick
      #     end
      #   end
      module ControllerHelper
        # Render full health check
        def render_nats_health
          result = Core::HealthCheck.check
          status_code = HealthEndpoint.http_status_for_health(result)

          render json: result.to_h, status: status_code
        end

        # Render quick health check
        def render_nats_health_quick
          result = Core::HealthCheck.quick_check
          status_code = result.healthy? ? 200 : 503

          render json: result.to_h, status: status_code
        end

        # Render liveness check
        def render_nats_liveness
          render json: {
            status: 'alive',
            timestamp: Time.now.iso8601
          }, status: 200
        end

        # Render readiness check
        def render_nats_readiness
          result = Core::HealthCheck.quick_check

          render json: {
            status: result.healthy? ? 'ready' : 'not_ready',
            healthy: result.healthy?,
            components: result.components,
            timestamp: Time.now.iso8601
          }, status: (result.healthy? ? 200 : 503)
        end
      end

      class << self
        # Determine HTTP status code from health result
        #
        # @param result [Core::HealthCheck::Result] Health check result
        # @return [Integer] HTTP status code
        def http_status_for_health(result)
          case result.status
          when :healthy
            200
          when :degraded
            200 # Return 200 for degraded but still functional
          when :unhealthy
            503
          else
            503
          end
        end

        private

        def not_found
          response = {
            error: 'Not Found',
            available_paths: ['/', '/quick', '/liveness', '/readiness']
          }

          [
            404,
            { 'Content-Type' => 'application/json' },
            [response.to_json]
          ]
        end
      end
    end
  end
end
