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

  it('retries on HTTP error and returns false only after exhausting all attempts', async () => {
    jest.useFakeTimers();
    mockFetch.mockResolvedValue({ ok: false, status: 422 });
    const service = new AttendService(
      makeConfig({
        ATTEND_API_KEY: 'secret-key',
        ATTEND_EVENT_SLUG: 'beest',
      }),
    );

    const resultPromise = service.inviteParticipant('bad-email');
    await jest.runAllTimersAsync();
    const result = await resultPromise;

    expect(result).toBe(false);
    expect(mockFetch).toHaveBeenCalledTimes(3);
    jest.useRealTimers();
  });

  it('retries after a transient failure and succeeds', async () => {
    jest.useFakeTimers();
    mockFetch
      .mockRejectedValueOnce(new Error('network down'))
      .mockResolvedValueOnce({ ok: true, status: 201 });
    const service = new AttendService(
      makeConfig({
        ATTEND_API_KEY: 'secret-key',
        ATTEND_EVENT_SLUG: 'beest',
      }),
    );

    const resultPromise = service.inviteParticipant('person@example.com');
    await jest.runAllTimersAsync();
    const result = await resultPromise;

    expect(result).toBe(true);
    expect(mockFetch).toHaveBeenCalledTimes(2);
    jest.useRealTimers();
  });

  it('returns false when every attempt throws', async () => {
    jest.useFakeTimers();
    mockFetch.mockRejectedValue(new Error('network down'));
    const service = new AttendService(
      makeConfig({
        ATTEND_API_KEY: 'secret-key',
        ATTEND_EVENT_SLUG: 'beest',
      }),
    );

    const resultPromise = service.inviteParticipant('person@example.com');
    await jest.runAllTimersAsync();
    const result = await resultPromise;

    expect(result).toBe(false);
    expect(mockFetch).toHaveBeenCalledTimes(3);
    jest.useRealTimers();
  });
});
