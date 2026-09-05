import {Param} from "../shared/types";
import {serializeParamsToBulk} from "./bulk";

export const APPLY_NOT_PROJECT = 'This tab is not a GitLab project. Open a project page and try Apply again.';

export function decideApplyUrl(tabUrl: string | undefined, params: Param[]): { url: string } | { error: string } {
    if (!tabUrl) {
        return {error: APPLY_NOT_PROJECT};
    }

    const url = buildPipelineNewUrl(tabUrl, params);
    if (url === null) {
        return {error: APPLY_NOT_PROJECT};
    }
    return {url};
}

function buildPipelineNewUrl(tabHref: string, params: Param[]): string | null {
    const base = projectBaseFromHref(tabHref);
    if (base === null) {
        return null;
    }
    return `${base}/-/pipelines/new${serializeParamsToBulk(params)}`;
}

function projectBaseFromHref(tabHref: string): string | null {
    let href = tabHref;
    const hashAt = href.indexOf('#');
    if (hashAt !== -1) {
        href = href.slice(0, hashAt);
    }
    const queryAt = href.indexOf('?');
    if (queryAt !== -1) {
        href = href.slice(0, queryAt);
    }
    const markerAt = href.indexOf('/-/');
    if (markerAt === -1) {
        return null;
    }
    return href.slice(0, markerAt);
}

