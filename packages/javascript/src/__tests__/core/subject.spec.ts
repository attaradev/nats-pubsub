import { Subject } from '../../core/subject';

describe('Subject utility', () => {
  describe('forTopic', () => {
    it('should build topic-based subject', () => {
      const subject = Subject.forTopic('production', 'myapp', 'user.created');
      expect(subject).toBe('production.myapp.user.created');
    });

    it('should build hierarchical topic subject', () => {
      const subject = Subject.forTopic('staging', 'api', 'notifications.email.sent');
      expect(subject).toBe('staging.api.notifications.email.sent');
    });

    it('should normalize topic names', () => {
      const subject = Subject.forTopic('production', 'myapp', 'User Created');
      expect(subject).toBe('production.myapp.user_created');
    });

    it('should preserve dots in topic names', () => {
      const subject = Subject.forTopic('production', 'myapp', 'notifications.email');
      expect(subject).toBe('production.myapp.notifications.email');
    });

    it('should preserve wildcards in topic names', () => {
      const subject = Subject.forTopic('production', 'myapp', 'users.*');
      expect(subject).toBe('production.myapp.users.*');
    });

    it('should preserve tail wildcard in topic names', () => {
      const subject = Subject.forTopic('production', 'myapp', 'notifications.>');
      expect(subject).toBe('production.myapp.notifications.>');
    });
  });

  describe('forEvent', () => {
    it('should build event-based subject', () => {
      const subject = Subject.forEvent('production', 'users', 'user', 'created');
      expect(subject).toBe('production.events.users.user.created');
    });

    it('should normalize domain/resource/action', () => {
      const subject = Subject.forEvent('production', 'User Domain', 'User Type', 'User Created');
      expect(subject).toBe('production.events.user_domain.user_type.user_created');
    });

    it('should build different event types', () => {
      expect(Subject.forEvent('production', 'orders', 'order', 'created')).toBe(
        'production.events.orders.order.created'
      );
      expect(Subject.forEvent('production', 'orders', 'order', 'updated')).toBe(
        'production.events.orders.order.updated'
      );
      expect(Subject.forEvent('production', 'orders', 'order', 'deleted')).toBe(
        'production.events.orders.order.deleted'
      );
    });
  });

  describe('forDlq', () => {
    it('should build DLQ subject', () => {
      const subject = Subject.forDlq('production');
      expect(subject).toBe('production.dlq');
    });

    it('should build DLQ subject for different environments', () => {
      expect(Subject.forDlq('staging')).toBe('staging.dlq');
      expect(Subject.forDlq('development')).toBe('development.dlq');
    });
  });

  describe('allEvents', () => {
    it('should build wildcard pattern for all events', () => {
      const subject = Subject.allEvents('production');
      expect(subject).toBe('production.events.>');
    });

    it('should build wildcard for different environments', () => {
      expect(Subject.allEvents('staging')).toBe('staging.events.>');
      expect(Subject.allEvents('development')).toBe('development.events.>');
    });
  });

  describe('parseTopic', () => {
    it('should parse topic-based subject', () => {
      const parsed = Subject.parseTopic('production.myapp.user.created');
      expect(parsed).toEqual({
        env: 'production',
        appName: 'myapp',
        topic: 'user.created',
      });
    });

    it('should parse hierarchical topic subject', () => {
      const parsed = Subject.parseTopic('production.myapp.notifications.email.sent');
      expect(parsed).toEqual({
        env: 'production',
        appName: 'myapp',
        topic: 'notifications.email.sent',
      });
    });

    it('should parse simple topic', () => {
      const parsed = Subject.parseTopic('production.myapp.notifications');
      expect(parsed).toEqual({
        env: 'production',
        appName: 'myapp',
        topic: 'notifications',
      });
    });

    it('should return null for invalid format (too few parts)', () => {
      const parsed = Subject.parseTopic('production.myapp');
      expect(parsed).toBeNull();
    });

    it('should return null for single part', () => {
      const parsed = Subject.parseTopic('production');
      expect(parsed).toBeNull();
    });

    it('should handle wildcard topics', () => {
      const parsed = Subject.parseTopic('production.myapp.users.*');
      expect(parsed).toEqual({
        env: 'production',
        appName: 'myapp',
        topic: 'users.*',
      });
    });
  });

  describe('parseEvent', () => {
    it('should parse event-based subject', () => {
      const parsed = Subject.parseEvent('production.events.users.user.created');
      expect(parsed).toEqual({
        env: 'production',
        domain: 'users',
        resource: 'user',
        action: 'created',
      });
    });

    it('should parse different event types', () => {
      expect(Subject.parseEvent('staging.events.orders.order.updated')).toEqual({
        env: 'staging',
        domain: 'orders',
        resource: 'order',
        action: 'updated',
      });
    });

    it('should return null for topic-based subject', () => {
      const parsed = Subject.parseEvent('production.myapp.user.created');
      expect(parsed).toBeNull();
    });

    it('should return null for invalid format (wrong part count)', () => {
      const parsed = Subject.parseEvent('production.events.users.user');
      expect(parsed).toBeNull();
    });

    it('should return null for non-events subject', () => {
      const parsed = Subject.parseEvent('production.topics.users.user.created');
      expect(parsed).toBeNull();
    });

    it('should return null for too few parts', () => {
      const parsed = Subject.parseEvent('production.events');
      expect(parsed).toBeNull();
    });
  });

  describe('isTopic', () => {
    it('should identify topic-based subjects', () => {
      expect(Subject.isTopic('production.myapp.user.created')).toBe(true);
      expect(Subject.isTopic('production.myapp.notifications.email')).toBe(true);
      expect(Subject.isTopic('production.myapp.simple')).toBe(true);
    });

    it('should not identify event-based subjects as topics', () => {
      expect(Subject.isTopic('production.events.users.user.created')).toBe(false);
    });

    it('should return false for invalid formats', () => {
      expect(Subject.isTopic('production.myapp')).toBe(false);
      expect(Subject.isTopic('production')).toBe(false);
    });
  });

  describe('isEvent', () => {
    it('should identify event-based subjects', () => {
      expect(Subject.isEvent('production.events.users.user.created')).toBe(true);
      expect(Subject.isEvent('staging.events.orders.order.updated')).toBe(true);
    });

    it('should not identify topic-based subjects as events', () => {
      expect(Subject.isEvent('production.myapp.user.created')).toBe(false);
    });

    it('should return false for invalid formats', () => {
      expect(Subject.isEvent('production.events.users')).toBe(false);
      expect(Subject.isEvent('production.topics.users.user.created')).toBe(false);
    });
  });

  describe('normalizeName', () => {
    it('should convert to lowercase', () => {
      expect(Subject.normalizeName('UserCreated')).toBe('usercreated');
    });

    it('should replace spaces with underscores', () => {
      expect(Subject.normalizeName('user created')).toBe('user_created');
    });

    it('should preserve dots', () => {
      expect(Subject.normalizeName('user.created')).toBe('user.created');
    });

    it('should preserve wildcards', () => {
      expect(Subject.normalizeName('users.*')).toBe('users.*');
      expect(Subject.normalizeName('users.>')).toBe('users.>');
    });

    it('should preserve hyphens', () => {
      expect(Subject.normalizeName('user-created')).toBe('user-created');
    });

    it('should replace special characters', () => {
      expect(Subject.normalizeName('user@created')).toBe('user_created');
      expect(Subject.normalizeName('user#created')).toBe('user_created');
      expect(Subject.normalizeName('user$created')).toBe('user_created');
    });

    it('should handle complex names', () => {
      expect(Subject.normalizeName('User Created Event!')).toBe('user_created_event_');
    });

    it('should preserve valid characters', () => {
      expect(Subject.normalizeName('user123.event-name_test')).toBe('user123.event-name_test');
    });
  });

  describe('matches', () => {
    describe('exact matching', () => {
      it('should match exact subjects', () => {
        expect(Subject.matches('production.myapp.user', 'production.myapp.user')).toBe(true);
        expect(
          Subject.matches('production.myapp.user.created', 'production.myapp.user.created')
        ).toBe(true);
      });

      it('should not match different subjects', () => {
        expect(Subject.matches('production.myapp.user', 'production.myapp.order')).toBe(false);
        expect(
          Subject.matches('production.myapp.user.created', 'production.myapp.user.updated')
        ).toBe(false);
      });
    });

    describe('single token wildcard (*)', () => {
      it('should match single token wildcard', () => {
        expect(Subject.matches('production.*.user', 'production.myapp.user')).toBe(true);
        expect(Subject.matches('production.myapp.*', 'production.myapp.user')).toBe(true);
        expect(Subject.matches('*.myapp.user', 'production.myapp.user')).toBe(true);
      });

      it('should not match multiple tokens with single wildcard', () => {
        expect(Subject.matches('production.*.user', 'production.myapp.something.user')).toBe(false);
      });

      it('should match multiple wildcards', () => {
        expect(Subject.matches('*.*.user', 'production.myapp.user')).toBe(true);
        expect(Subject.matches('production.*.*.created', 'production.myapp.user.created')).toBe(
          true
        );
      });
    });

    describe('tail wildcard (>)', () => {
      it('should match tail wildcard', () => {
        expect(Subject.matches('production.>', 'production.myapp.user')).toBe(true);
        expect(Subject.matches('production.>', 'production.myapp.user.created')).toBe(true);
        expect(Subject.matches('production.myapp.>', 'production.myapp.user.created')).toBe(true);
      });

      it('should match tail wildcard with exact tokens before', () => {
        expect(Subject.matches('production.events.>', 'production.events.users.user.created')).toBe(
          true
        );
      });

      it('should not match if prefix does not match', () => {
        expect(Subject.matches('staging.>', 'production.myapp.user')).toBe(false);
        expect(Subject.matches('production.other.>', 'production.myapp.user')).toBe(false);
      });
    });

    describe('complex patterns', () => {
      it('should match mixed wildcards', () => {
        expect(Subject.matches('production.*.>', 'production.myapp.user.created')).toBe(true);
        expect(Subject.matches('*.events.>', 'production.events.users.user.created')).toBe(true);
      });

      it('should handle real-world patterns', () => {
        // All events in production
        expect(Subject.matches('production.events.>', 'production.events.users.user.created')).toBe(
          true
        );

        // Any app's user events in production
        expect(Subject.matches('production.*.user.*', 'production.myapp.user.created')).toBe(true);

        // All user-related events
        expect(Subject.matches('*.*.user.>', 'production.events.user.created')).toBe(true);
      });
    });

    describe('edge cases', () => {
      it('should handle empty tokens gracefully', () => {
        expect(Subject.matches('production', 'production')).toBe(true);
      });

      it('should handle pattern longer than subject', () => {
        expect(Subject.matches('production.myapp.user.created', 'production.myapp')).toBe(false);
      });

      it('should handle subject longer than pattern (without wildcards)', () => {
        expect(Subject.matches('production.myapp', 'production.myapp.user')).toBe(false);
      });
    });
  });

  describe('isValid', () => {
    describe('valid subjects', () => {
      it('should validate simple subjects', () => {
        expect(Subject.isValid('production.myapp.user')).toBe(true);
        expect(Subject.isValid('staging.api.notifications')).toBe(true);
      });

      it('should validate hierarchical subjects', () => {
        expect(Subject.isValid('production.myapp.users.user.created')).toBe(true);
        expect(Subject.isValid('a.b.c.d.e.f.g')).toBe(true);
      });

      it('should validate subjects with hyphens', () => {
        expect(Subject.isValid('production.my-app.user-created')).toBe(true);
      });

      it('should validate subjects with underscores', () => {
        expect(Subject.isValid('production.my_app.user_created')).toBe(true);
      });

      it('should validate subjects with numbers', () => {
        expect(Subject.isValid('prod123.app456.event789')).toBe(true);
      });

      it('should validate subjects with wildcards', () => {
        expect(Subject.isValid('production.myapp.*')).toBe(true);
        expect(Subject.isValid('production.myapp.>')).toBe(true);
        expect(Subject.isValid('production.*.user.>')).toBe(true);
      });
    });

    describe('invalid subjects', () => {
      it('should reject empty subjects', () => {
        expect(Subject.isValid('')).toBe(false);
      });

      it('should reject subjects starting with dot', () => {
        expect(Subject.isValid('.production.myapp.user')).toBe(false);
      });

      it('should reject subjects ending with dot', () => {
        expect(Subject.isValid('production.myapp.user.')).toBe(false);
      });

      it('should reject consecutive dots', () => {
        expect(Subject.isValid('production..myapp.user')).toBe(false);
        expect(Subject.isValid('production.myapp..user')).toBe(false);
      });

      it('should reject invalid characters', () => {
        expect(Subject.isValid('production.myapp.user@domain')).toBe(false);
        expect(Subject.isValid('production.myapp.user#event')).toBe(false);
        expect(Subject.isValid('production.myapp.user$event')).toBe(false);
        expect(Subject.isValid('production.myapp.user event')).toBe(false);
      });

      it('should reject tail wildcard not at end', () => {
        expect(Subject.isValid('production.>.myapp.user')).toBe(false);
        expect(Subject.isValid('production.>.user')).toBe(false);
      });
    });
  });
});
