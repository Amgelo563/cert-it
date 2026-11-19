import ipaddr, { type IPv4, type IPv6 } from 'ipaddr.js';

type ClientIpResolverOptions = {
  /** CIDR ranges allowed to set the client IP through proxy headers. */
  trustedProxies: string[];
};

/** An object that finds a request's client IP, trusting proxy headers only from trusted proxies. */
export class ClientIpResolver {
  protected readonly trustedProxies: [IPv4 | IPv6, number][];

  constructor(options: ClientIpResolverOptions) {
    this.trustedProxies = options.trustedProxies.map((cidr) =>
      ipaddr.parseCIDR(cidr),
    );
  }

  /** Returns the client IP of a request from the given address with the given headers. */
  public resolve(remoteAddress: string, headers: Headers): string {
    if (!ipaddr.isValid(remoteAddress)) return remoteAddress;

    const remote = ipaddr.process(remoteAddress);
    if (!this.isTrusted(remote)) return remote.toString();

    const forwarded =
      headers.get('x-real-ip')?.trim()
      ?? headers.get('x-forwarded-for')?.split(',').at(-1)?.trim();

    return forwarded && ipaddr.isValid(forwarded)
      ? ipaddr.process(forwarded).toString()
      : remote.toString();
  }

  protected isTrusted(address: IPv4 | IPv6): boolean {
    return this.trustedProxies.some(
      ([range, bits]) =>
        range.kind() === address.kind() && address.match(range, bits),
    );
  }
}
