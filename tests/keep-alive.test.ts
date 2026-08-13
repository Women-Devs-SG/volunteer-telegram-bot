import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

vi.mock('../src/db-drizzle', () => ({
  DrizzleDatabaseService: {
    pingDatabase: vi.fn(),
  }
}));

describe('Keep-alive endpoint', () => {
  const ORIGINAL_CRON_SECRET = process.env.CRON_SECRET;
  let mockReq: any;
  let mockRes: any;

  beforeEach(() => {
    vi.clearAllMocks();
    delete process.env.CRON_SECRET;
    mockReq = { headers: {} };
    mockRes = {
      status: vi.fn().mockReturnThis(),
      json: vi.fn().mockReturnThis(),
    };
  });

  afterEach(() => {
    if (ORIGINAL_CRON_SECRET === undefined) {
      delete process.env.CRON_SECRET;
    } else {
      process.env.CRON_SECRET = ORIGINAL_CRON_SECRET;
    }
  });

  it('pings the database and returns 200 when no CRON_SECRET is configured', async () => {
    const { DrizzleDatabaseService } = await import('../src/db-drizzle');
    vi.mocked(DrizzleDatabaseService.pingDatabase).mockResolvedValue(true);

    const handler = (await import('../api/keep-alive')).default;
    await handler(mockReq, mockRes);

    expect(DrizzleDatabaseService.pingDatabase).toHaveBeenCalledTimes(1);
    expect(mockRes.status).toHaveBeenCalledWith(200);
    expect(mockRes.json).toHaveBeenCalledWith(expect.objectContaining({ ok: true }));
  });

  it('returns 500 and logs when the database ping fails', async () => {
    const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const { DrizzleDatabaseService } = await import('../src/db-drizzle');
    vi.mocked(DrizzleDatabaseService.pingDatabase).mockResolvedValue(false);

    const handler = (await import('../api/keep-alive')).default;
    await handler(mockReq, mockRes);

    expect(mockRes.status).toHaveBeenCalledWith(500);
    expect(mockRes.json).toHaveBeenCalledWith(expect.objectContaining({ ok: false }));
    expect(consoleErrorSpy).toHaveBeenCalled();

    consoleErrorSpy.mockRestore();
  });

  it('rejects requests without a valid CRON_SECRET and never touches the database', async () => {
    process.env.CRON_SECRET = 'test-secret';
    mockReq.headers.authorization = 'Bearer wrong-secret';

    const { DrizzleDatabaseService } = await import('../src/db-drizzle');
    const handler = (await import('../api/keep-alive')).default;
    await handler(mockReq, mockRes);

    expect(DrizzleDatabaseService.pingDatabase).not.toHaveBeenCalled();
    expect(mockRes.status).toHaveBeenCalledWith(401);
  });

  it('accepts requests carrying the correct CRON_SECRET bearer token', async () => {
    process.env.CRON_SECRET = 'test-secret';
    mockReq.headers.authorization = 'Bearer test-secret';

    const { DrizzleDatabaseService } = await import('../src/db-drizzle');
    vi.mocked(DrizzleDatabaseService.pingDatabase).mockResolvedValue(true);

    const handler = (await import('../api/keep-alive')).default;
    await handler(mockReq, mockRes);

    expect(DrizzleDatabaseService.pingDatabase).toHaveBeenCalledTimes(1);
    expect(mockRes.status).toHaveBeenCalledWith(200);
  });
});
