# frozen_string_literal: true

module NatsPubsub
  # Subject matching helpers.
  module SubjectMatcher
    module_function

    def covered?(patterns, subject)
      Array(patterns).any? { |pat| match?(pat.to_s, subject.to_s) }
    end

    # Proper NATS semantics:
    # - '*' matches exactly one token
    # - '>' matches the rest (zero or more tokens)
    def match?(pattern, subject)
      pattern_tokens = pattern.split('.')
      subject_tokens = subject.split('.')

      index = 0
      while index < pattern_tokens.length && index < subject_tokens.length
        pattern_token = pattern_tokens[index]
        case pattern_token
        when '>'
          return true # tail wildcard absorbs the rest
        when '*'
          # matches this token; continue
        else
          return false unless pattern_token == subject_tokens[index]
        end
        index += 1
      end

      # Exact match
      return true if index == pattern_tokens.length && index == subject_tokens.length

      # If pattern has remaining '>' it can absorb remainder
      pattern_tokens[index] == '>' || pattern_tokens[index..]&.include?('>')
    end

    # Do two wildcard patterns admit at least one same subject?
    def overlap?(sub_a, sub_b)
      overlap_parts?(sub_a.split('.'), sub_b.split('.'))
    end

    def overlap_parts?(a_parts, b_parts)
      a_index = 0
      b_index = 0
      while a_index < a_parts.length && b_index < b_parts.length
        a_token = a_parts[a_index]
        b_token = b_parts[b_index]
        return true if has_tail_wildcard?(a_token, b_token)
        return false unless token_match?(a_token, b_token)

        a_index += 1
        b_index += 1
      end

      tail_overlap?(a_parts[a_index..], b_parts[b_index..])
    end

    def has_tail_wildcard?(a_token, b_token)
      a_token == '>' || b_token == '>'
    end

    def token_match?(a_token, b_token)
      a_token == b_token || a_token == '*' || b_token == '*'
    end

    def tail_overlap?(a_tail, b_tail)
      a_tail ||= []
      b_tail ||= []
      return true if a_tail.include?('>') || b_tail.include?('>')

      a_tail.empty? && b_tail.empty?
    end
  end
end
