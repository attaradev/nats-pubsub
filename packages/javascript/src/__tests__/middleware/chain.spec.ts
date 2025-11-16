import MiddlewareChain from '../../middleware/chain';
import { Middleware, EventMetadata } from '../../types';

describe('MiddlewareChain', () => {
  let chain: MiddlewareChain;

  beforeEach(() => {
    chain = new MiddlewareChain();
  });

  describe('add', () => {
    it('should add middleware to the chain', () => {
      const middleware: Middleware = {
        call: jest.fn(async (_event, _metadata, next) => next()),
      };

      chain.add(middleware);
      expect(chain['middlewares']).toContain(middleware);
    });

    it('should add multiple middleware in order', () => {
      const middleware1: Middleware = {
        call: jest.fn(async (_event, _metadata, next) => next()),
      };
      const middleware2: Middleware = {
        call: jest.fn(async (_event, _metadata, next) => next()),
      };

      chain.add(middleware1);
      chain.add(middleware2);

      expect(chain['middlewares'][0]).toBe(middleware1);
      expect(chain['middlewares'][1]).toBe(middleware2);
    });
  });

  describe('execute', () => {
    it('should execute middleware in order', async () => {
      const executionOrder: number[] = [];

      const middleware1: Middleware = {
        call: async (_event, _metadata, next) => {
          executionOrder.push(1);
          await next();
          executionOrder.push(4);
        },
      };

      const middleware2: Middleware = {
        call: async (_event, _metadata, next) => {
          executionOrder.push(2);
          await next();
          executionOrder.push(3);
        },
      };

      chain.add(middleware1);
      chain.add(middleware2);

      const handler = jest.fn();
      const event = { id: '123' };
      const metadata: EventMetadata = {
        event_id: '123',
        subject: 'test.subject',
        action: 'created',
        domain: 'test',
        resource: 'test',
      };

      await chain.execute(event, metadata, handler);

      expect(executionOrder).toEqual([1, 2, 3, 4]);
    });

    it('should call handler after all middleware', async () => {
      const middleware: Middleware = {
        call: jest.fn(async (_event, _metadata, next) => next()),
      };

      chain.add(middleware);

      const handler = jest.fn();
      const event = { id: '123' };
      const metadata: EventMetadata = {
        event_id: '123',
        subject: 'test.subject',
        action: 'created',
        domain: 'test',
        resource: 'test',
      };

      await chain.execute(event, metadata, handler);

      expect(middleware.call).toHaveBeenCalled();
      expect(handler).toHaveBeenCalledWith(event, metadata);
    });

    it('should allow middleware to modify event', async () => {
      const middleware: Middleware = {
        call: async (event, _metadata, next) => {
          event.modified = true;
          await next();
        },
      };

      chain.add(middleware);

      const handler = jest.fn();
      const event: any = { id: '123' };
      const metadata: EventMetadata = {
        event_id: '123',
        subject: 'test.subject',
        action: 'created',
        domain: 'test',
        resource: 'test',
      };

      await chain.execute(event, metadata, handler);

      expect(handler).toHaveBeenCalledWith(
        expect.objectContaining({ modified: true }),
        metadata
      );
    });

    it('should stop execution if middleware does not call next', async () => {
      const middleware1: Middleware = {
        call: async (_event, _metadata, _next) => {
          // Don't call next()
        },
      };

      const middleware2: Middleware = {
        call: jest.fn(async (_event, _metadata, next) => next()),
      };

      chain.add(middleware1);
      chain.add(middleware2);

      const handler = jest.fn();
      const event = { id: '123' };
      const metadata: EventMetadata = {
        event_id: '123',
        subject: 'test.subject',
        action: 'created',
        domain: 'test',
        resource: 'test',
      };

      await chain.execute(event, metadata, handler);

      expect(middleware2.call).not.toHaveBeenCalled();
      expect(handler).not.toHaveBeenCalled();
    });

    it('should handle middleware errors', async () => {
      const error = new Error('Middleware error');
      const middleware: Middleware = {
        call: async (_event, _metadata, _next) => {
          throw error;
        },
      };

      chain.add(middleware);

      const handler = jest.fn();
      const event = { id: '123' };
      const metadata: EventMetadata = {
        event_id: '123',
        subject: 'test.subject',
        action: 'created',
        domain: 'test',
        resource: 'test',
      };

      await expect(
        chain.execute(event, metadata, handler)
      ).rejects.toThrow('Middleware error');

      expect(handler).not.toHaveBeenCalled();
    });

    it('should work with empty middleware chain', async () => {
      const handler = jest.fn();
      const event = { id: '123' };
      const metadata: EventMetadata = {
        event_id: '123',
        subject: 'test.subject',
        action: 'created',
        domain: 'test',
        resource: 'test',
      };

      await chain.execute(event, metadata, handler);

      expect(handler).toHaveBeenCalledWith(event, metadata);
    });

    it('should allow middleware to catch and handle errors', async () => {
      const errorHandlingMiddleware: Middleware = {
        call: async (event, _metadata, next) => {
          try {
            await next();
          } catch (_error) {
            // Handle error - don't propagate
            event.error_handled = true;
          }
        },
      };

      const errorThrowingMiddleware: Middleware = {
        call: async (_event, _metadata, _next) => {
          throw new Error('Test error');
        },
      };

      chain.add(errorHandlingMiddleware);
      chain.add(errorThrowingMiddleware);

      const handler = jest.fn();
      const event: any = { id: '123' };
      const metadata: EventMetadata = {
        event_id: '123',
        subject: 'test.subject',
        action: 'created',
        domain: 'test',
        resource: 'test',
      };

      await chain.execute(event, metadata, handler);

      expect(event.error_handled).toBe(true);
      expect(handler).not.toHaveBeenCalled();
    });
  });
});
