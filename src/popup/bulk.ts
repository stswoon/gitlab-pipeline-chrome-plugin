import {Param, Profile} from "../shared/types";
import {parseQuery} from "../shared/query";

export function displayBulkText(profile: Profile): string {
    return profile.bulkText !== undefined ? profile.bulkText : serializeParamsToBulk(profile.params);
}

export function serializeParamsToBulk(params: Param[]): string {
    const search = new URLSearchParams();
    for (const {key, value} of params) {
        if (key.trim() === '') {
            continue;
        }
        search.append(key, value);
    }
    const encoded = search.toString();
    return encoded === '' ? '' : `?${encoded}`;
}

export function applyBulkInput(profile: Profile, raw: string): { profile: Profile; bulkValid: boolean } {
    if (!isValidBulkText(raw)) {
        return {profile: {...profile, bulkText: raw}, bulkValid: false};
    }
    return {
        profile: {...profile, bulkText: raw, params: parseQuery(raw)},
        bulkValid: true,
    };
}

export function isValidBulkText(raw: string): boolean {
    const trimmed = raw.trim();
    if (trimmed === '' || trimmed === '?') {
        return true;
    }
    if (trimmed.includes('#')) {
        return false;
    }
    if (/[ \t\n\r]/.test(trimmed)) {
        return false;
    }
    const body = trimmed.startsWith('?') ? trimmed.slice(1) : trimmed;
    for (const segment of body.split('&')) {
        if (segment === '') {
            continue;
        }
        if (segment.startsWith('=')) {
            return false;
        }
    }
    return true;
}
