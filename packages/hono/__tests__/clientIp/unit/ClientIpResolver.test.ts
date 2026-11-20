import { Hono } from 'hono';
import { describe, expect, test } from 'vite-plus/test';
import type { ClientIpEnv } from '../../../src/clientIp/ClientIpEnv';
import { ClientIpResolver } from '../../../src/clientIp/ClientIpResolver';

// the connection address, as an adapter's getConnInfo would read it
type RemoteEnv = ClientIpEnv & { Bindings: { remoteAddress?: string } };

const resolver = new ClientIpResolver({
  trustedProxies: ['127.0.0.0/8', '10.0.0.0/8', '::1/128', 'fc00::/7'],
  getConnInfo: (c) => ({
    remote: { address: (c.env as RemoteEnv['Bindings']).remoteAddress },
  }),
});

const headers = (init: Record<string, string>) => new Headers(init);

describe('ClientIpResolver (untrusted)', () => {
  test('GIVEN an untrusted address with proxy headers WHEN resolving THEN ignores the headers', () => {
    const ip = resolver.resolve(
      '203.0.113.9',
      headers({ 'x-real-ip': '1.1.1.1', 'x-forwarded-for': '2.2.2.2' }),
    );

    expect(ip).toBe('203.0.113.9');
  });

  test('GIVEN an IPv4-mapped untrusted address WHEN resolving THEN returns the IPv4 form', () => {
    expect(resolver.resolve('::ffff:203.0.113.9', headers({}))).toBe(
      '203.0.113.9',
    );
  });
});

describe('ClientIpResolver (trusted)', () => {
  test('GIVEN a trusted proxy with X-Real-IP WHEN resolving THEN prefers it over X-Forwarded-For', () => {
    const ip = resolver.resolve(
      '127.0.0.1',
      headers({ 'x-real-ip': '198.51.100.1', 'x-forwarded-for': '2.2.2.2' }),
    );

    expect(ip).toBe('198.51.100.1');
  });

  test('GIVEN a trusted proxy with only X-Forwarded-For WHEN resolving THEN takes the rightmost entry', () => {
    const ip = resolver.resolve(
      '10.0.0.5',
      headers({ 'x-forwarded-for': '6.6.6.6, 198.51.100.2' }),
    );

    expect(ip).toBe('198.51.100.2');
  });

  test('GIVEN an IPv4-mapped loopback proxy WHEN resolving THEN trusts it', () => {
    const ip = resolver.resolve(
      '::ffff:127.0.0.1',
      headers({ 'x-real-ip': '198.51.100.3' }),
    );

    expect(ip).toBe('198.51.100.3');
  });

  test('GIVEN a trusted IPv6 proxy WHEN resolving THEN uses the header', () => {
    const ip = resolver.resolve(
      'fd00::1',
      headers({ 'x-real-ip': '2001:db8:0:0::1' }),
    );

    expect(ip).toBe('2001:db8::1');
  });

  test('GIVEN a trusted proxy with an invalid header WHEN resolving THEN falls back to the connection address', () => {
    const ip = resolver.resolve(
      '127.0.0.1',
      headers({ 'x-real-ip': 'not-an-ip' }),
    );

    expect(ip).toBe('127.0.0.1');
  });

  test('GIVEN a trusted proxy without headers WHEN resolving THEN returns the connection address', () => {
    expect(resolver.resolve('::1', headers({}))).toBe('::1');
  });
});

describe('ClientIpResolver (middleware)', () => {
  function request(
    remoteAddress: string | undefined,
    headers: Record<string, string> = {},
  ): Promise<string> {
    const app = new Hono<RemoteEnv>();
    app.use(resolver.middleware());
    app.get('/', (c) => c.text(c.get('clientIp')));

    return Promise.resolve(
      app.request('/', { headers }, { remoteAddress }),
    ).then((response) => response.text());
  }

  test('GIVEN a trusted proxy with X-Real-IP WHEN requesting THEN sets the forwarded client IP', async () => {
    expect(await request('127.0.0.1', { 'x-real-ip': '198.51.100.1' })).toBe(
      '198.51.100.1',
    );
  });

  test('GIVEN an untrusted address WHEN requesting THEN sets the connection address', async () => {
    expect(await request('203.0.113.9', { 'x-real-ip': '1.1.1.1' })).toBe(
      '203.0.113.9',
    );
  });

  test('GIVEN no connection address WHEN requesting THEN sets an empty client IP', async () => {
    expect(await request(undefined)).toBe('');
  });
});
