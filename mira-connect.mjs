// Node.js server-side client.
export class MiraConnect {
  #token;
  #hubOrigin;
  #encoding;
  constructor(submitUrl, statusTemplate, token, encoding = 'json') {
    if (!['json', 'form'].includes(encoding)) throw new Error('Unknown encoding');
    this.#encoding = encoding;
    this.#hubOrigin = new URL(submitUrl).origin;
    if (new URL(statusTemplate).origin !== this.#hubOrigin) throw new Error('Endpoints must use the same hub origin');
    this.submitUrl = submitUrl;
    this.statusTemplate = statusTemplate;
    this.#token = token;
  }

  async request(url, body) {
    const target = new URL(url);
    if (target.origin !== this.#hubOrigin || target.username || target.password) throw new Error('Invalid hub URL');
    const local = target.protocol === 'http:' && ['localhost', '127.0.0.1'].includes(target.hostname);
    if (target.protocol !== 'https:' && !local) throw new Error('HTTPS required');
    const headers = { Authorization: 'Bearer ' + this.#token, Accept: 'application/json' };
    let payload;
    if (this.#encoding === 'form') {
      payload = new URLSearchParams(body ? {...body, args: JSON.stringify(body.args)} : {});
    } else if (body) {
      headers['Content-Type'] = 'application/json';
      payload = JSON.stringify(body);
    }
    const response = await fetch(target, {
      headers, method: payload === undefined ? 'GET' : 'POST', body: payload,
      redirect: 'error', signal: AbortSignal.timeout(30000)
    });
    if (!response.ok) throw Object.assign(new Error('HTTP ' + response.status), {status: response.status});
    return response.json();
  }

  validateId(id) {
    if (typeof id !== 'string' || !id || /[^A-Za-z0-9_-]/.test(id)) throw new Error('Invalid request ID');
  }

  submit(id, action, args) {
    this.validateId(id);
    if (!args || typeof args !== 'object' || Array.isArray(args)) throw new Error('args must be an object');
    return this.request(this.submitUrl, {request_id: id, action, args});
  }

  status(id) {
    this.validateId(id);
    return this.request(this.statusTemplate.replaceAll('{id}', id));
  }
}
