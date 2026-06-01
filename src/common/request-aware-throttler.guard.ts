import { Injectable } from '@nestjs/common';
import { ThrottlerGuard } from '@nestjs/throttler';

@Injectable()
export class RequestAwareThrottlerGuard extends ThrottlerGuard {
  protected override getTracker(req: Record<string, unknown>): Promise<string> {
    const userId = this.extractUserIdFromAuthorization(req.headers);
    if (userId) {
      return Promise.resolve(`user:${userId}`);
    }

    const ip = typeof req.ip === 'string' ? req.ip : null;
    const socketAddress = this.extractSocketAddress(req.socket);
    return Promise.resolve(`ip:${ip ?? socketAddress ?? 'unknown'}`);
  }

  private extractUserIdFromAuthorization(headers: unknown) {
    if (!headers || typeof headers !== 'object') {
      return null;
    }

    const authorization = (headers as { authorization?: unknown })
      .authorization;
    if (typeof authorization !== 'string') {
      return null;
    }

    const match = authorization.match(/^Bearer\s+(.+)$/i);
    if (!match) {
      return null;
    }

    return this.extractJwtSubject(match[1]);
  }

  private extractJwtSubject(token: string) {
    const [, payload] = token.split('.');
    if (!payload) {
      return null;
    }

    try {
      const parsed: unknown = JSON.parse(
        Buffer.from(payload, 'base64url').toString('utf8'),
      );
      if (!parsed || typeof parsed !== 'object') {
        return null;
      }

      const subject = (parsed as Record<string, unknown>).sub;
      return typeof subject === 'string' && subject.length > 0 ? subject : null;
    } catch {
      return null;
    }
  }

  private extractSocketAddress(socket: unknown) {
    if (!socket || typeof socket !== 'object') {
      return null;
    }

    const remoteAddress = (socket as { remoteAddress?: unknown }).remoteAddress;
    return typeof remoteAddress === 'string' ? remoteAddress : null;
  }
}
