import { createPublicKey, type JsonWebKey, verify } from 'node:crypto';

/** A compact JWS, split and decoded. */
export type DecodedJwt = {
  header: Record<string, unknown>;
  payload: Record<string, any>;
};

/**
 * Checks an RS256 JWT against a public JWK, as a verifier does, and decodes it.
 *
 * @throws {Error} If the signature doesn't match.
 */
export function verifyJwt(jwt: string, jwk: JsonWebKey): DecodedJwt {
  const [header = '', payload = '', signature = ''] = jwt.split('.');
  const valid = verify(
    'sha256',
    Buffer.from(`${header}.${payload}`),
    createPublicKey({ key: jwk, format: 'jwk' }),
    Buffer.from(signature, 'base64url'),
  );
  if (!valid) throw new Error('The JWT signature is not valid.');

  const decode = (part: string) =>
    JSON.parse(Buffer.from(part, 'base64url').toString('utf8'));
  return { header: decode(header), payload: decode(payload) };
}
