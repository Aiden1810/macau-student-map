export function percentile(values, quantile) {
  if (!values.length) return null;
  const sorted = [...values].sort((a, b) => a - b);
  return Number(sorted[Math.max(0, Math.ceil(quantile * sorted.length) - 1)].toFixed(2));
}

export function summarizeSamples(samples, elapsedMs) {
  const success = samples.filter(sample => sample.ok);
  const round = number => Number(number.toFixed(2));
  const statuses = {};
  for (const sample of samples) statuses[sample.status] = (statuses[sample.status] ?? 0) + 1;
  return {requests: samples.length, failures: samples.length - success.length,
    errorPercent: samples.length ? round((samples.length - success.length) / samples.length * 100) : null,
    rps: round(samples.length / (elapsedMs / 1000)),
    successP50Ms: percentile(success.map(sample => sample.durationMs), 0.5),
    successP95Ms: percentile(success.map(sample => sample.durationMs), 0.95),
    successP99Ms: percentile(success.map(sample => sample.durationMs), 0.99),
    allP95Ms: percentile(samples.map(sample => sample.durationMs), 0.95),
    bytes: samples.reduce((sum, sample) => sum + sample.bytes, 0), statuses};
}

export function assertIsolatedTarget(value) {
  const url = new URL(value);
  if (url.protocol !== 'http:' || url.hostname !== '127.0.0.1' || !url.port || url.username || url.password
    || url.pathname !== '/' || url.search || url.hash) throw new Error('Capacity tests only accept an explicit loopback HTTP origin.');
  return url.origin;
}
