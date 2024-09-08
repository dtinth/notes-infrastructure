import { jwtVerify, SignJWT } from 'jose'

export function mintAccessToken() {
  return new SignJWT({ jti: new Date().toISOString() })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setIssuer('https://notes.dt.in.th')
    .setExpirationTime('1h')
    .sign(getKey())
}

function getKey() {
  return new TextEncoder().encode(
    process.env.NOTES_API_KEY || raise('NOTES_API_KEY is not set')
  )
}

export function verifyAccessToken(token: string) {
  return jwtVerify(token, getKey(), { issuer: 'https://notes.dt.in.th' })
}

function raise(message: string): never {
  throw new Error(message)
}
