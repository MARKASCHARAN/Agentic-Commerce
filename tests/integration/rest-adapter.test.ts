import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import * as http from 'http';
import { 
  RESTToolAdapter, 
  RESTConnectionError, 
  RESTResponseError,
  RESTProtocolError,
  RESTToolAdapterError
} from '../../src/agent/tools/adapters/rest';

describe('RESTToolAdapter', () => {
  let server: http.Server;
  let baseUrl: string;

  beforeAll(async () => {
    server = http.createServer((req, res) => {
      // Collect body for POST/PUT/PATCH
      let body = '';
      req.on('data', chunk => {
        body += chunk;
      });
      req.on('end', () => {
        const url = new URL(req.url || '', `http://${req.headers.host}`);
        
        if (url.pathname === '/echo') {
          res.writeHead(200, { 'Content-Type': 'application/json' });
          let requestBody = {};
          if (body) {
            try { requestBody = JSON.parse(body); } catch (e) {}
          }
          res.end(JSON.stringify({ 
            method: req.method, 
            path: url.pathname, 
            query: Object.fromEntries(url.searchParams.entries()),
            headers: req.headers,
            body: requestBody 
          }));
          return;
        }

        if (url.pathname === '/no-content') {
          res.writeHead(204);
          res.end();
          return;
        }

        if (url.pathname === '/not-found') {
          res.writeHead(404, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: { message: 'Resource not found' } }));
          return;
        }

        if (url.pathname === '/internal-error') {
          res.writeHead(500, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ message: 'Internal Server Error' }));
          return;
        }

        if (url.pathname === '/bad-json') {
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end('{ invalid json');
          return;
        }

        if (url.pathname === '/delay') {
          setTimeout(() => {
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ delayed: true }));
          }, 2000);
          return;
        }

        res.writeHead(404);
        res.end();
      });
    });

    await new Promise<void>((resolve) => {
      server.listen(0, '127.0.0.1', () => resolve());
    });
    const addr = server.address() as import('net').AddressInfo;
    baseUrl = `http://127.0.0.1:${addr.port}`;
  });

  afterAll(() => {
    server.close();
  });

  const baseContext = {
    executionId: 'exec-1',
    agentId: 'agent-1',
    sessionId: 'session-1'
  };

  it('should successfully make a POST request with body and headers', async () => {
    const adapter = new RESTToolAdapter({
      baseUrl,
      defaultHeaders: { 'Authorization': 'Bearer test-token' },
      requestMapping: (input: { msg: string }) => ({
        method: 'POST',
        path: '/echo',
        headers: { 'X-Custom-Header': 'custom-value' },
        body: { message: input.msg },
        query: { q: 'search' }
      })
    });

    const result = await adapter.execute({ msg: 'hello' }, baseContext) as any;

    expect(result.method).toBe('POST');
    expect(result.path).toBe('/echo');
    expect(result.query.q).toBe('search');
    expect(result.headers['authorization']).toBe('Bearer test-token');
    expect(result.headers['x-custom-header']).toBe('custom-value');
    expect(result.headers['content-type']).toBe('application/json');
    expect(result.body.message).toBe('hello');
  });

  it('should successfully make a GET request without a body', async () => {
    const adapter = new RESTToolAdapter({
      baseUrl,
      requestMapping: () => ({
        method: 'GET',
        path: '/echo',
        query: { filter: 'active' }
      })
    });

    const result = await adapter.execute({}, baseContext) as any;

    expect(result.method).toBe('GET');
    expect(result.query.filter).toBe('active');
    expect(Object.keys(result.body)).toHaveLength(0); // empty body
  });

  it('should handle 204 No Content gracefully', async () => {
    const adapter = new RESTToolAdapter({
      baseUrl,
      requestMapping: () => ({ method: 'DELETE', path: '/no-content' })
    });

    const result = await adapter.execute({}, baseContext);
    expect(result).toEqual({});
  });

  it('should translate 404 responses into RESTResponseError', async () => {
    const adapter = new RESTToolAdapter({
      baseUrl,
      requestMapping: () => ({ method: 'GET', path: '/not-found' })
    });

    try {
      await adapter.execute({}, baseContext);
      expect.fail('Should have thrown');
    } catch (e: any) {
      expect(e).toBeInstanceOf(RESTResponseError);
      expect(e.status).toBe(404);
      expect(e.message).toContain('Resource not found');
    }
  });

  it('should translate 500 responses into RESTResponseError', async () => {
    const adapter = new RESTToolAdapter({
      baseUrl,
      requestMapping: () => ({ method: 'POST', path: '/internal-error' })
    });

    try {
      await adapter.execute({}, baseContext);
      expect.fail('Should have thrown');
    } catch (e: any) {
      expect(e).toBeInstanceOf(RESTResponseError);
      expect(e.status).toBe(500);
      expect(e.message).toContain('Internal Server Error');
    }
  });

  it('should translate malformed JSON responses into RESTProtocolError', async () => {
    const adapter = new RESTToolAdapter({
      baseUrl,
      requestMapping: () => ({ method: 'GET', path: '/bad-json' })
    });

    try {
      await adapter.execute({}, baseContext);
      expect.fail('Should have thrown');
    } catch (e: any) {
      expect(e).toBeInstanceOf(RESTProtocolError);
      expect(e.message).toContain('Failed to parse REST response as JSON');
    }
  });

  it('should translate connection failures into RESTConnectionError', async () => {
    const adapter = new RESTToolAdapter({
      baseUrl: 'http://127.0.0.1:1', // Nothing should be listening here
      requestMapping: () => ({ method: 'GET', path: '/' })
    });

    try {
      await adapter.execute({}, baseContext);
      expect.fail('Should have thrown');
    } catch (e: any) {
      expect(e).toBeInstanceOf(RESTConnectionError);
      expect(e.message).toContain('Failed to connect to http://127.0.0.1:1');
    }
  });

  it('should abort execution before HTTP request if signal is already aborted', async () => {
    const adapter = new RESTToolAdapter({
      baseUrl,
      requestMapping: () => ({ method: 'GET', path: '/echo' })
    });

    const controller = new AbortController();
    controller.abort(new Error('Pre-aborted'));

    await expect(adapter.execute({}, { ...baseContext, abortSignal: controller.signal }))
      .rejects.toThrowError('Pre-aborted');
  });

  it('should abort in-flight HTTP request if signal is aborted mid-flight', async () => {
    const adapter = new RESTToolAdapter({
      baseUrl,
      requestMapping: () => ({ method: 'GET', path: '/delay' })
    });

    const controller = new AbortController();
    
    // Abort after 100ms
    setTimeout(() => {
      controller.abort(new Error('Mid-flight abort'));
    }, 100);

    await expect(adapter.execute({}, { ...baseContext, abortSignal: controller.signal }))
      .rejects.toThrowError('Mid-flight abort');
  });

  it('should allow custom response transformers', async () => {
    const adapter = new RESTToolAdapter({
      baseUrl,
      requestMapping: () => ({ method: 'GET', path: '/echo' }),
      responseMapping: async (response) => {
        const json = await response.json();
        return { customMappedMethod: json.method };
      }
    });

    const result = await adapter.execute({}, baseContext);
    expect(result).toEqual({ customMappedMethod: 'GET' });
  });

});
