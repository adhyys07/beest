import { ConfigService } from '@nestjs/config';
import { AttendService } from './attend.service';
import { fetchWithTimeout } from '../fetch.util';

jest.mock('../fetch.util');

const mockFetch = fetchWithTimeout as jest.Mock;

function makeConfig(values: Record<string, string | undefined>): ConfigService {
  return { get: (key: string) => values[key] } as unknown as ConfigService;
}

describe('AttendService', () => {
  afterEach(() => jest.clearAllMocks());

  it('is disabled and never calls fetch when unconfigured', async () => {
    const service = new AttendService(makeConfig({}));
    const result = await service.inviteParticipant(
      'person@example.com',
      'Ada Lovelace',
    );
    expect(result).toBe(false);
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it('posts to the configured event and splits the name', async () => {
    mockFetch.mockResolvedValue({ ok: true, status: 201 });
    const service = new AttendService(
      makeConfig({
        ATTEND_BASE_URL: 'https://attend.example.com',
        ATTEND_API_KEY: 'secret-key',
        ATTEND_EVENT_SLUG: 'beest',
      }),
    );

    const result = await service.inviteParticipant(
      'person@example.com',
      'Ada Lovelace',
    );

    expect(result).toBe(true);
    expect(mockFetch).toHaveBeenCalledWith(
      'https://attend.example.com/api/v1/events/beest/participants',
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({
          Authorization: 'Bearer secret-key',
        }),
        body: JSON.stringify({
          email: 'person@example.com',
          first_name: 'Ada',
          last_name: 'Lovelace',
        }),
      }),
    );
  });

  it('treats a 409 (already invited) as success', async () => {
    mockFetch.mockResolvedValue({ ok: false, status: 409 });
    const service = new AttendService(
      makeConfig({
        ATTEND_API_KEY: 'secret-key',
        ATTEND_EVENT_SLUG: 'beest',
      }),
    );

    const result = await service.inviteParticipant('person@example.com');
    expect(result).toBe(true);
  });

  it('returns false on other HTTP errors', async () => {
    mockFetch.mockResolvedValue({ ok: false, status: 422 });
    const service = new AttendService(
      makeConfig({
        ATTEND_API_KEY: 'secret-key',
        ATTEND_EVENT_SLUG: 'beest',
      }),
    );

    const result = await service.inviteParticipant('bad-email');
    expect(result).toBe(false);
  });

  it('returns false when the request throws', async () => {
    mockFetch.mockRejectedValue(new Error('network down'));
    const service = new AttendService(
      makeConfig({
        ATTEND_API_KEY: 'secret-key',
        ATTEND_EVENT_SLUG: 'beest',
      }),
    );

    const result = await service.inviteParticipant('person@example.com');
    expect(result).toBe(false);
  });
});
