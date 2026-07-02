import { describe, expect, it } from 'vitest';
import { createCacheBustedUrl } from '../systems/cacheBuster';

describe('cache busting', () => {
  it('adds the current build id to the URL', () => {
    expect(createCacheBustedUrl('https://example.com/sigil-breaker/', 'build-123')).toBe(
      'https://example.com/sigil-breaker/?v=build-123',
    );
  });

  it('replaces an existing build id without removing other query params', () => {
    expect(createCacheBustedUrl('https://example.com/sigil-breaker/?level=3&v=old', 'new')).toBe(
      'https://example.com/sigil-breaker/?level=3&v=new',
    );
  });
});
