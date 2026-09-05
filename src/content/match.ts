export type LocationLike = {
  protocol: string;
  hostname: string;
  pathname: string;
  search: string;
};

export function isRunNewPipelinePage(loc: LocationLike): boolean {
  if (loc.protocol !== 'http:' && loc.protocol !== 'https:') {
    return false;
  }
  if (!loc.hostname.toLowerCase().includes('gitlab')) {
    return false;
  }
  return /\/-\/pipelines\/new\/?$/.test(loc.pathname);
}

export function hasQueryParams(search: string): boolean {
  if (search === '' || search === '?') {
    return false;
  }
  return new URLSearchParams(search).size > 0;
}
