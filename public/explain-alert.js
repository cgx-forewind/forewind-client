// Create once per selected alert. Calling the returned function resumes the same job.
export function createAlertExplanation(args) {
  const id = crypto.randomUUID();
  const body = JSON.stringify({ request_id: id, action: 'explain', args });
  let submitted = false;

  return async function getExplanation() {
    const signal = AbortSignal.timeout(120_000);
    if (!submitted) {
      const response = await fetch('/api/explain', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body,
        signal,
      });
      if (!response.ok) throw new Error('Submission failed');
      submitted = true;
    }
    while (!signal.aborted) {
      await new Promise(resolve => setTimeout(resolve, 2000));
      const response = await fetch('/api/explain/' + id, { signal, cache: 'no-store' });
      if (!response.ok) throw new Error('Status lookup failed');
      const job = await response.json();
      if (job.status === 'failed') return { status: 'failed' };
      if (job.status === 'done' && typeof job.result?.text === 'string' && job.result.text.trim())
        return { status: 'done', text: job.result.text };
      if (!['queued', 'running'].includes(job.status)) throw new Error('Unexpected job response');
    }
    throw signal.reason;
  };
}
