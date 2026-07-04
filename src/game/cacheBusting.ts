interface VersionManifest {
  buildId: string;
  builtAt: string;
}

export interface CacheBustingState {
  currentBuildId: string;
  latestBuildId: string | null;
  checked: boolean;
  updateAvailable: boolean;
  error: string | null;
}

declare global {
  interface Window {
    __SIGILBREAKER_CACHE__?: CacheBustingState;
  }
}

export function initializePagesCacheBusting(): CacheBustingState {
  const state: CacheBustingState = {
    currentBuildId: __SIGILBREAKER_BUILD_ID__,
    latestBuildId: null,
    checked: false,
    updateAvailable: false,
    error: null,
  };

  window.__SIGILBREAKER_CACHE__ = state;

  if (import.meta.env.DEV) {
    state.checked = true;
    state.latestBuildId = state.currentBuildId;
    return state;
  }

  void checkVersion(state);
  return state;
}

async function checkVersion(state: CacheBustingState): Promise<void> {
  try {
    const response = await fetch(`${import.meta.env.BASE_URL}version.json?cache=${Date.now()}`, {
      cache: 'no-store',
    });
    if (!response.ok) {
      throw new Error(`version check failed with ${response.status}`);
    }

    const manifest = (await response.json()) as VersionManifest;
    state.latestBuildId = manifest.buildId;
    state.updateAvailable = Boolean(manifest.buildId && manifest.buildId !== state.currentBuildId);
    state.checked = true;

    if (state.updateAvailable) {
      reloadWithBuildQuery(manifest.buildId);
    }
  } catch (error) {
    state.checked = true;
    state.error = error instanceof Error ? error.message : String(error);
  }
}

function reloadWithBuildQuery(buildId: string): void {
  const url = new URL(window.location.href);
  if (url.searchParams.get('build') === buildId) {
    return;
  }

  url.searchParams.set('build', buildId);
  window.location.replace(url.toString());
}

