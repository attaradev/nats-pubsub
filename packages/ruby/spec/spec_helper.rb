# frozen_string_literal: true

require 'bundler/setup'
Bundler.require(:default, :test)

# Load the gem
require 'nats_pubsub'

# Load support files
Dir[File.expand_path('support/**/*.rb', __dir__)].each { |f| require f }

RSpec.configure do |config|
  # Enable flags like --only-failures and --next-failure
  config.example_status_persistence_file_path = '.rspec_status'

  # Disable RSpec exposing methods globally on `Module` and `main`
  config.disable_monkey_patching!

  # Use the documentation formatter for detailed output
  config.default_formatter = 'doc' if config.files_to_run.one?

  # Run specs in random order to surface order dependencies
  config.order = :random
  Kernel.srand config.seed

  # Configure expectations
  config.expect_with :rspec do |c|
    c.syntax = :expect
    c.include_chain_clauses_in_custom_matcher_descriptions = true
  end

  # Configure mocks
  config.mock_with :rspec do |mocks|
    mocks.verify_partial_doubles = true
  end

  # Reset NatsPubsub configuration before each test
  config.before(:each) do
    NatsPubsub.reset!
  end

  # Shared context for NATS connection (optional)
  config.shared_context_metadata_behavior = :apply_to_host_groups
end

# Simplecov for code coverage (optional)
if ENV['COVERAGE']
  require 'simplecov'
  SimpleCov.start do
    add_filter '/spec/'
    add_filter '/vendor/'
    enable_coverage :branch
    minimum_coverage line: 80, branch: 60
  end
end
