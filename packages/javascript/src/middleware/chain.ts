import { EventMetadata, Middleware } from '../types';

export class MiddlewareChain {
  private middlewares: Middleware[] = [];

  add(middleware: Middleware): void {
    this.middlewares.push(middleware);
  }

  async execute(
    event: Record<string, unknown>,
    metadata: EventMetadata,
    handler: () => Promise<void>
  ): Promise<void> {
    let index = 0;

    const next = async (): Promise<void> => {
      if (index < this.middlewares.length) {
        const middleware = this.middlewares[index++];
        await middleware.call(event, metadata, next);
      } else {
        await handler();
      }
    };

    await next();
  }
}
