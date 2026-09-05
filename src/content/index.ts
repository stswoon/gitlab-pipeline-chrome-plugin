import { parseQuery } from '../shared/query';
import { hasQueryParams, isRunNewPipelinePage } from './match';
import { waitForForm } from './wait';

(function gitlabPipelinePrefill(): void {
  let filling = false;
  let done = false;

  if (!isRunNewPipelinePage(window.location)) {
    return;
  }
  if (!hasQueryParams(window.location.search)) {
    return;
  }
  if (filling || done) {
    return;
  }

  filling = true;

  void (async () => {
    try {
      const ready = await waitForForm(document, 15_000);
      if (!ready) {
        console.warn('[GitLab Pipeline Prefill] Run new pipeline form not ready within 15s');
        return;
      }
      const params = parseQuery(window.location.search);
      if (params.length === 0) {
        return;
      }
      void params;
    } finally {
      done = true;
      filling = false;
    }
  })();
})();
