# frozen_string_literal: true

module NatsPubsub
  # Immutable value object representing a NATS subject.
  # Provides validation, normalization, and pattern matching for NATS subjects.
  #
  # NATS subjects are dot-separated strings that support wildcards:
  # - '*' matches exactly one token
  # - '>' matches one or more tokens (only valid at end)
  #
  # @example Creating a subject
  #   subject = Subject.new('production.myapp.users.created')
  #   subject.tokens # => ['production', 'myapp', 'users', 'created']
  #
  # @example Pattern matching
  #   pattern = Subject.new('production.*.users.*')
  #   pattern.matches?('production.myapp.users.created') # => true
  #
  # @example Wildcard subjects
  #   wildcard = Subject.new('production.myapp.>')
  #   wildcard.wildcard? # => true
  #   wildcard.matches?('production.myapp.users.created') # => true
  class Subject
    attr_reader :value, :tokens

    # NATS subject constraints
    MAX_LENGTH = 255
    VALID_PATTERN = /\A[a-zA-Z0-9_.*>-]+(\.[a-zA-Z0-9_.*>-]+)*\z/

    # Initialize a new Subject
    #
    # @param value [String, Subject] Subject string or another Subject
    # @raise [ArgumentError] if subject is invalid
    def initialize(value)
      @value = value.is_a?(Subject) ? value.value : value.to_s
      validate!
      @tokens = @value.split('.')
      freeze
    end

    # Build subject from domain, resource, and action
    #
    # @param env [String] Environment name
    # @param app_name [String] Application name
    # @param domain [String] Domain name
    # @param resource [String] Resource type
    # @param action [String] Action performed
    # @return [Subject] New subject instance
    def self.from_event(env:, app_name:, domain:, resource:, action:)
      new("#{env}.#{app_name}.#{domain}.#{resource}.#{action}")
    end

    # Build subject for topic
    #
    # @param env [String] Environment name
    # @param app_name [String] Application name
    # @param topic [String] Topic name
    # @return [Subject] New subject instance
    def self.from_topic(env:, app_name:, topic:)
      normalized_topic = normalize_topic(topic)
      new("#{env}.#{app_name}.#{normalized_topic}")
    end

    # Normalize topic name for use in subjects
    # Preserves dots for hierarchical topics and NATS wildcards
    #
    # @param topic [String] Topic name
    # @return [String] Normalized topic name
    def self.normalize_topic(topic)
      topic.to_s.downcase.gsub(/[^a-z0-9_.>*-]/, '_')
    end

    # Check if subject contains wildcards
    #
    # @return [Boolean] True if contains * or >
    def wildcard?
      @value.include?('*') || @value.include?('>')
    end

    # Check if subject contains tail wildcard (>)
    #
    # @return [Boolean] True if ends with >
    def tail_wildcard?
      @value.end_with?('.>')
    end

    # Check if this subject/pattern matches another subject
    # Note: Requires SubjectMatcher to be loaded
    #
    # @param other [String, Subject] Subject to match against
    # @return [Boolean] True if matches
    def matches?(other)
      require_relative '../topology/subject_matcher' unless defined?(NatsPubsub::SubjectMatcher)
      other_subject = other.is_a?(Subject) ? other : Subject.new(other)
      SubjectMatcher.match?(@value, other_subject.value)
    end

    # Check if two subjects overlap (both could match the same message)
    # Note: Requires SubjectMatcher to be loaded
    #
    # @param other [String, Subject] Subject to check overlap with
    # @return [Boolean] True if subjects overlap
    def overlaps?(other)
      require_relative '../topology/subject_matcher' unless defined?(NatsPubsub::SubjectMatcher)
      other_subject = other.is_a?(Subject) ? other : Subject.new(other)
      SubjectMatcher.overlap?(@value, other_subject.value)
    end

    # Get the number of tokens in the subject
    #
    # @return [Integer] Token count
    def token_count
      @tokens.size
    end

    # Check if subject is empty
    #
    # @return [Boolean] True if empty
    def empty?
      @value.empty?
    end

    # String representation
    #
    # @return [String] Subject value
    def to_s
      @value
    end

    # Equality comparison
    #
    # @param other [Object] Object to compare
    # @return [Boolean] True if equal
    def ==(other)
      case other
      when Subject
        @value == other.value
      when String
        @value == other
      else
        false
      end
    end

    alias eql? ==

    # Hash code for use in hash tables
    #
    # @return [Integer] Hash code
    def hash
      @value.hash
    end

    # Inspect representation
    #
    # @return [String] Inspection string
    def inspect
      "#<Subject:#{@value}>"
    end

    private

    # Validate subject format
    #
    # @raise [ArgumentError] if invalid
    def validate!
      raise ArgumentError, 'Subject cannot be nil' if @value.nil?
      raise ArgumentError, 'Subject cannot be empty' if @value.empty?
      raise ArgumentError, "Subject too long (max #{MAX_LENGTH} chars)" if @value.length > MAX_LENGTH
      raise ArgumentError, "Invalid subject format: #{@value}" unless @value =~ VALID_PATTERN
      validate_wildcard_placement!
    end

    # Validate wildcard placement rules
    #
    # @raise [ArgumentError] if wildcard placement is invalid
    def validate_wildcard_placement!
      # '>' can only appear at the end
      if @value.include?('>')
        raise ArgumentError, "Wildcard '>' must be at the end of subject" unless @value.end_with?('.>')
        raise ArgumentError, "Subject cannot contain multiple '>' wildcards" if @value.count('>') > 1
      end
    end
  end
end
