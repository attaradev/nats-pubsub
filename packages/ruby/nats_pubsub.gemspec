# frozen_string_literal: true

require_relative 'lib/nats_pubsub/version'

Gem::Specification.new do |spec|
  spec.name                  = 'nats_pubsub'
  spec.version               = NatsPubsub::VERSION
  spec.authors               = ['Mike Attara']
  spec.email                 = ['mpyebattara@gmail.com']

  spec.summary     = 'Declarative PubSub messaging for NATS JetStream'
  spec.description = <<~DESC.strip
    A production-ready pub/sub library for NATS JetStream with Rails integration.
    Features declarative subscribers, auto-discovery, middleware support, Web UI
    for monitoring Inbox/Outbox events, and production-ready patterns including
    Inbox/Outbox, DLQ, and automatic retries with backoff.
  DESC

  spec.license  = 'MIT'
  spec.homepage = 'https://github.com/attaradev/nats_pubsub'

  # Runtime environment
  spec.required_ruby_version     = '>= 3.2.0'
  spec.required_rubygems_version = '>= 3.3.0'

  # Rich metadata
  spec.metadata = {
    'homepage_uri' => 'https://github.com/attaradev/nats_pubsub',
    'source_code_uri' => 'https://github.com/attaradev/nats_pubsub',
    'changelog_uri' => 'https://github.com/attaradev/nats_pubsub/blob/main/CHANGELOG.md',
    'documentation_uri' => 'https://github.com/attaradev/nats_pubsub#readme',
    'bug_tracker_uri' => 'https://github.com/attaradev/nats_pubsub/issues',
    'github_repo' => 'ssh://github.com/attaradev/nats_pubsub',
    'rubygems_mfa_required' => 'true'
  }

  # Safer file list
  spec.files = Dir.glob('{lib,README*,CHANGELOG*,LICENSE*}/**/*', File::FNM_DOTMATCH)
                  .select { |f| File.file?(f) }
                  .reject { |f| f.start_with?('spec/', '.') }

  spec.require_paths = ['lib']

  # ---- Runtime dependencies ----
  spec.add_dependency 'activerecord',  '>= 6.0', '< 9'
  spec.add_dependency 'activesupport', '>= 6.0', '< 9'
  spec.add_dependency 'nats-pure',     '~> 2.5'
  spec.add_dependency 'oj', '>= 3.16'
  spec.add_dependency 'sinatra', '>= 3', '< 5' # For Web UI
end
