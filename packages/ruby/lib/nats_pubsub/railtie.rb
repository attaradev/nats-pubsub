# frozen_string_literal: true

require_relative 'models/model_codec_setup'

module NatsPubsub
  class Railtie < ::Rails::Railtie
    # Configuration before Rails initialization
    config.before_configuration do
      # Set default configuration from environment
      NatsPubsub.configure do |config|
        config.env = ENV.fetch('RAILS_ENV', 'development')
        config.app_name = Rails.application.class.module_parent_name.underscore
      end
    end

    # Model codec setup after ActiveRecord loads
    initializer 'nats_pubsub.defer_model_tweaks', after: :active_record do
      ActiveSupport.on_load(:active_record) do
        ActiveSupport::Reloader.to_prepare do
          NatsPubsub::ModelCodecSetup.apply!
        end
      end
    end

    # Validate configuration after initialization
    initializer 'nats_pubsub.validate_config', after: :load_config_initializers do
      Rails.application.config.after_initialize do
        next unless NatsPubsub.configuration

        begin
          NatsPubsub.configuration.validate!
        rescue NatsPubsub::ConfigurationError => e
          Rails.logger.warn "[NatsPubsub] Configuration warning: #{e.message}"
        end
      end
    end

    # Auto-discover subscribers in development
    initializer 'nats_pubsub.auto_discover_subscribers' do
      Rails.application.config.to_prepare do
        if Rails.env.development? || Rails.env.test?
          NatsPubsub::Subscribers::Registry.instance.discover_subscribers!
        end
      end
    end

    # Load rake tasks
    rake_tasks do
      load File.expand_path('tasks/install.rake', __dir__)
    end
  end
end
