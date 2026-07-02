const CURRENT_BUILD_STORAGE_KEY = 'sigilbreaker.current-build.v1';
const RELOAD_STORAGE_KEY = 'sigilbreaker.reload-build.v1';

interface VersionManifest {
  buildId?: unknown;
}

export function initializeCacheBuster(): void {
  if (typeof window === 'undefined' || import.meta.env.DEV) {
    return;
  }

  window.localStorage.setItem(CURRENT_BUILD_STORAGE_KEY, __SIGILBREAKER_BUILD_ID__);

  const checkForUpdate = (): void => {
    void reloadIfNewerBuildExists(__SIGILBREAKER_BUILD_ID__);
  };

  window.setTimeout(checkForUpdate, 1500);
  window.addEventListener('focus', checkForUpdate);
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') {
      checkForUpdate();
    }
  });
}

export async function reloadIfNewerBuildExists(currentBuildId: string): Promise<void> {
  const latestBuildId = await fetchLatestBuildId();
  if (!latestBuildId || latestBuildId === currentBuildId) {
    return;
  }

  const reloadToken = `${currentBuildId}->${latestBuildId}`;
  if (window.sessionStorage.getItem(RELOAD_STORAGE_KEY) === reloadToken) {
    return;
  }

  window.sessionStorage.setItem(RELOAD_STORAGE_KEY, reloadToken);
  window.location.replace(createCacheBustedUrl(window.location.href, latestBuildId));
}

export async function fetchLatestBuildId(): Promise<string | undefined> {
  try {
    const manifestUrl = new URL(`${import.meta.env.BASE_URL}version.json`, window.location.origin);
    manifestUrl.searchParams.set('t', Date.now().toString());

    const response = await fetch(manifestUrl, {
      cache: 'no-store',
      headers: {
        'Cache-Control': 'no-cache',
      },
    });

    if (!response.ok) {
      return undefined;
    }

    const manifest = (await response.json()) as VersionManifest;
    return typeof manifest.buildId === 'string' ? manifest.buildId : undefined;
  } catch {
    return undefined;
  }
}

export function createCacheBustedUrl(href: string, buildId: string): string {
  const url = new URL(href);
  url.searchParams.set('v', buildId);
  return url.toString();
}
