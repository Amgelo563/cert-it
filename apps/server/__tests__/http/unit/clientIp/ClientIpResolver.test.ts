import { describe, expect, test } from 'vite-plus/test';
import { ClientIpResolver } from '../../../../src/http/clientIp/ClientIpResolver';

const resolver = new ClientIpResolver({
  trustedProxies: ['127.0.0.0/8', '10.0.0.0/8', '::1/128', 'fc00::/7'],
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
