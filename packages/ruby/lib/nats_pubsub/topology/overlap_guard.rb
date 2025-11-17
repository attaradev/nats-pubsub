# frozen_string_literal: true

require 'oj'
require_relative 'subject_matcher'
require_relative '../core/logging'

module NatsPubsub
  # Checks for overlapping subjects.
  class OverlapGuard
    class << self
      # Raise if any desired subjects conflict with other streams.
      def check!(jts, target_name, new_subjects)
        conflicts = overlaps(jts, target_name, new_subjects)
        return if conflicts.empty?

        raise conflict_message(target_name, conflicts)
      end

      # Return a list of conflicts against other streams, per subject.
      # [{ name:'OTHER' pairs: [['a.b.*', 'a.b.c'], ...] }, ...]
      def overlaps(jts, target_name, new_subjects)
        desired = StreamSupport.normalize_subjects(new_subjects)
        streams = list_streams_with_subjects(jts)
        others  = streams.reject { |stream| stream[:name] == target_name }

        others.filter_map do |stream|
          pairs = desired.flat_map do |desired_subject|
            stream_subjects = StreamSupport.normalize_subjects(stream[:subjects])
            stream_subjects.select { |existing_subject| SubjectMatcher.overlap?(desired_subject, existing_subject) }
                          .map { |existing_subject| [desired_subject, existing_subject] }
          end
          { name: stream[:name], pairs: pairs } unless pairs.empty?
        end
      end

      # Returns [allowed, blocked] given desired subjects.
      def partition_allowed(jts, target_name, desired_subjects)
        desired   = StreamSupport.normalize_subjects(desired_subjects)
        conflicts = overlaps(jts, target_name, desired)
        blocked   = conflicts.flat_map { |c| c[:pairs].map(&:first) }.uniq
        allowed   = desired - blocked
        [allowed, blocked]
      end

      def allowed_subjects(jts, target_name, desired_subjects)
        partition_allowed(jts, target_name, desired_subjects).first
      end

      private

      def list_streams_with_subjects(jts)
        list_stream_names(jts).map do |name|
          info = jts.stream_info(name)
          { name: name, subjects: Array(info.config.subjects || []) }
        end
      end

      def list_stream_names(jts)
        names  = []
        offset = 0
        loop do
          resp  = js_api_request(jts, '$JS.API.STREAM.NAMES', { offset: offset })
          batch = Array(resp['streams']).filter_map { |h| h['name'] }
          names.concat(batch)
          break if names.size >= resp['total'].to_i || batch.empty?

          offset = names.size
        end
        names
      end

      def js_api_request(jts, subject, payload = {})
        # JetStream client should expose the underlying NATS client as `nc`
        msg = jts.nc.request(subject, Oj.dump(payload, mode: :compat))
        Oj.load(msg.data, mode: :strict)
      end

      def conflict_message(target, conflicts)
        msg = "Overlapping subjects for stream #{target}:\n"
        conflicts.each do |c|
          msg << "- Conflicts with '#{c[:name]}' on:\n"
          c[:pairs].each { |(a, b)| msg << "    • #{a} × #{b}\n" }
        end
        msg
      end
    end
  end
end
