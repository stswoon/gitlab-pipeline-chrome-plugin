export function isOnNewPipelinePage(loc: Location): boolean {
    if (loc.protocol !== 'http:' && loc.protocol !== 'https:') {
        return false;
    }
    return /\/-\/pipelines\/new\/?$/.test(loc.pathname);
}

export function hasQueryParams(search: string): boolean {
    return new URLSearchParams(search ?? '').size > 0;
}
