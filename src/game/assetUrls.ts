const PUBLIC_ASSET_VERSION_PARAM = 'assetBuild';

export function publicAssetUrl(path: string): string {
  return withAssetVersion(`${import.meta.env.BASE_URL}${path}`);
}

export function withAssetVersion(url: string): string {
  if (url.startsWith('data:') || url.startsWith('blob:')) {
    return url;
  }

  const hashIndex = url.indexOf('#');
  const withoutHash = hashIndex === -1 ? url : url.slice(0, hashIndex);
  const hash = hashIndex === -1 ? '' : url.slice(hashIndex);
  if (new RegExp(`[?&]${PUBLIC_ASSET_VERSION_PARAM}=`).test(withoutHash)) {
    return url;
  }

  const separator = withoutHash.includes('?') ? '&' : '?';
  return `${withoutHash}${separator}${PUBLIC_ASSET_VERSION_PARAM}=${encodeURIComponent(__SIGILBREAKER_BUILD_ID__)}${hash}`;
}
