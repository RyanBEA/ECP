/**
 * POST a simulation request to the perf server.
 *
 * @param {object} body - { ecp_state, geometry, perf_extras }
 * @returns {Promise<object>} - { annual_energy_gj, breakdown_gj, ... }
 * @throws {Error} on HTTP error; .status carries the response status code
 */
export async function postSimulate(body) {
  const response = await fetch('/api/simulate', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const detail = await response.json().catch(() => ({}));
    const err = new Error(detail.detail || `simulate failed: HTTP ${response.status}`);
    err.status = response.status;
    throw err;
  }

  return response.json();
}
