import { createRemoteJWKSet, jwtVerify } from 'jose'

export const firebaseIssuer = 'https://securetoken.google.com/dtinth-notes'
const keySetUrl = new URL(
  'https://www.googleapis.com/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com'
)
const audience = 'dtinth-notes'
const keySet = createRemoteJWKSet(keySetUrl)

export function validateFirebaseJwt(jwt: string) {
  return jwtVerify(jwt, keySet, { issuer: firebaseIssuer, audience })
}
