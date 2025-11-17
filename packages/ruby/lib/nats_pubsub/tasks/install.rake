# frozen_string_literal: true

namespace :nats_pubsub do
  desc 'Install NatsPubsub (initializer + migrations)'
  task install: :environment do
    puts '[nats_pubsub] Generating initializer and migrations...'
    Rails::Generators.invoke('nats_pubsub:install', [], behavior: :invoke, destination_root: Rails.root.to_s)
    puts '[nats_pubsub] Done.'
  end
end
