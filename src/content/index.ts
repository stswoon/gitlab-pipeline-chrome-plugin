import {fillForm} from './fill';
import {waitForForm} from './wait';
import {parseQuery} from "../shared/query";

async function gitlabPipelinePrefill() {
    if (!isOnNewPipelinePage(window.location)) {
        return;
    }
    if (!hasQueryParams(window.location.search)) {
        return;
    }

    console.info('[GitLab Pipeline Prefill] Start fill new pipeline form');
    try {
        const ready = await waitForForm(document, 15_000);
        if (!ready) {
            console.error('[GitLab Pipeline Prefill] Run new pipeline form not ready within 15s');
            return;
        }
        const params = parseQuery(window.location.search);
        if (params.length === 0) {
            return;
        }
        await fillForm(document, params);
        console.info('[GitLab Pipeline Prefill] Successfully finish filling new pipeline form');
    } catch (e) {
        console.error('[GitLab Pipeline Prefill] Error during fill new pipeline form: ', e);
    }
}

gitlabPipelinePrefill();

export function isOnNewPipelinePage(loc: Location): boolean {
    if (loc.protocol !== 'http:' && loc.protocol !== 'https:') {
        return false;
    }
    return /\/-\/pipelines\/new\/?$/.test(loc.pathname);
}

export function hasQueryParams(search: string): boolean {
    return new URLSearchParams(search ?? '').size > 0;
}

