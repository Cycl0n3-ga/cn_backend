import { configureHttpApp } from './app-setup.js';
import { INestApplication } from '@nestjs/common';

describe('configureHttpApp CORS configurations', () => {
  let mockApp: any;
  let capturedCorsOptions: any;
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = { ...originalEnv };
    capturedCorsOptions = null;
    mockApp = {
      setGlobalPrefix: jest.fn(),
      enableCors: jest.fn((options) => {
        capturedCorsOptions = options;
      }),
      useGlobalPipes: jest.fn(),
      useGlobalFilters: jest.fn(),
      useGlobalInterceptors: jest.fn(),
    };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  function getOrigins(): (string | RegExp)[] {
    configureHttpApp(mockApp);
    return capturedCorsOptions.origin;
  }

  function testOrigin(origins: (string | RegExp)[], originToTest: string): boolean {
    return origins.some((pattern) => {
      if (pattern instanceof RegExp) {
        return pattern.test(originToTest);
      }
      return pattern === originToTest;
    });
  }

  it('should support default origins (localhost and cn-22.vercel.app)', () => {
    delete process.env.CORS_ORIGINS;
    const origins = getOrigins();

    expect(testOrigin(origins, 'http://localhost:3000')).toBe(true);
    expect(testOrigin(origins, 'https://cn-22.vercel.app')).toBe(true);
    // Vercel preview domain for cn-22
    expect(testOrigin(origins, 'https://cn-22-git-main-username.vercel.app')).toBe(true);
    // Rejected non-matching vercel domains
    expect(testOrigin(origins, 'https://another-app.vercel.app')).toBe(false);
  });

  it('should support wildcard domains in CORS_ORIGINS (demonstrating current wildcard bug)', () => {
    process.env.CORS_ORIGINS = 'https://*.vercel.app';
    const origins = getOrigins();

    // With the current bug, these will fail!
    expect(testOrigin(origins, 'https://abc.vercel.app')).toBe(true);
  });

  it('should support dynamic preview domains for custom Vercel production domains (demonstrating custom domain preview bug)', () => {
    process.env.CORS_ORIGINS = 'https://my-custom-app.vercel.app';
    const origins = getOrigins();

    expect(testOrigin(origins, 'https://my-custom-app.vercel.app')).toBe(true);
    // With the current bug, this preview domain will fail because 'cn-22' is hardcoded!
    expect(testOrigin(origins, 'https://my-custom-app-git-main-username.vercel.app')).toBe(true);
  });
});
