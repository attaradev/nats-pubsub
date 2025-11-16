# frozen_string_literal: true

require_relative '../core/config'
require_relative '../core/logging'
require_relative 'stream'

module NatsPubsub
  class Topology
    def self.ensure!(jts)
      cfg = NatsPubsub.config

      # Create stream for all PubSub events
      subjects = ["#{cfg.env}.events.>"]
      subjects << cfg.dlq_subject if cfg.use_dlq

      Stream.ensure!(jts, cfg.stream_name, subjects)

      Logging.info(
        "PubSub stream ready: #{cfg.stream_name} with subjects=#{subjects.inspect}",
        tag: 'NatsPubsub::Topology'
      )
    end
  end
end
