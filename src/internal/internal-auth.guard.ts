import {
  Injectable,
  CanActivate,
  ExecutionContext,
  UnauthorizedException,
} from '@nestjs/common';

/**
 * Guard for internal API endpoints.
 * In production, this should validate internal IP ranges or service mesh tokens.
 * For development, we use a simple API key check.
 */
@Injectable()
export class InternalAuthGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();
    const apiKey = request.headers['x-internal-api-key'];
    const expectedKey = process.env.INTERNAL_API_KEY;

    if (!expectedKey || apiKey !== expectedKey) {
      throw new UnauthorizedException('Invalid or missing internal API key.');
    }

    return true;
  }
}
