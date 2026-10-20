import { jwtVerify, SignJWT } from 'jose'

// Same issuer and key as legacy, so tokens stay compatible during cutover.
const ISSUER = 'https://notes.dt.in.th'

export function mintAccessToken(secret: string) {
  return new SignJWT({ jti: new Date().toISOString() })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setIssuer(ISSUER)
    .setExpirationTime('1h')
    .sign(new TextEncoder().encode(secret))
}

export async function verifyAccessToken(token: string, secret: string) {
  await jwtVerify(token, new TextEncoder().encode(secret), { issuer: ISSUER })
}
