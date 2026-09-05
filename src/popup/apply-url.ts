import { buildPipelineNewUrl} from '../shared/query';
import {Param} from "../shared/types";

export const APPLY_NOT_PROJECT = 'This tab is not a GitLab project. Open a project page and try Apply again.';

export function decideApplyUrl(tabUrl: string | undefined, params: Param[]): { url: string } | { error: string } {
  if (!tabUrl) {
    return { error: APPLY_NOT_PROJECT };
  }

  const url = buildPipelineNewUrl(tabUrl, params);
  if (url === null) {
    return { error: APPLY_NOT_PROJECT };
  }
  return { url };
}
