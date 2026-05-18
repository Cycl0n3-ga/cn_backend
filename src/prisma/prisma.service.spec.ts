import { PrismaService } from './prisma.service';

describe('PrismaService', () => {
  const originalDatabaseUrl = process.env.DATABASE_URL;

  afterEach(() => {
    process.env.DATABASE_URL = originalDatabaseUrl;
    jest.restoreAllMocks();
  });

  it('should be defined', () => {
    process.env.DATABASE_URL = 'file:./test-prisma.db';
    const service = new PrismaService();
    expect(service).toBeDefined();
  });

  it('should call $connect on module init', async () => {
    process.env.DATABASE_URL = 'file:./test-prisma.db';
    const service = new PrismaService();

    const connectSpy = jest
      .spyOn(service, '$connect')
      .mockResolvedValue(undefined as any);

    await service.onModuleInit();

    expect(connectSpy).toHaveBeenCalledTimes(1);
  });

  it('should call $disconnect on module destroy', async () => {
    process.env.DATABASE_URL = 'file:./test-prisma.db';
    const service = new PrismaService();

    const disconnectSpy = jest
      .spyOn(service, '$disconnect')
      .mockResolvedValue(undefined as any);

    await service.onModuleDestroy();

    expect(disconnectSpy).toHaveBeenCalledTimes(1);
  });
});
