import { createRemoteJWKSet, jwtVerify } from 'jose'

const issuer = 'https://accounts.google.com'
const keySetUrl = new URL('https://www.googleapis.com/oauth2/v3/certs')
const audience =
  '413915959575-0i3lqth0o4b07k6v7e1ssar6kg4n52uk.apps.googleusercontent.com'
const keySet = createRemoteJWKSet(keySetUrl)

export function validateJwt(jwt: string) {
  return jwtVerify(jwt, keySet, { issuer, audience })
}
