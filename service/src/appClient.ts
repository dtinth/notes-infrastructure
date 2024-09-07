import { treaty } from '@elysiajs/eden'
import { App } from '../scripts/start_notes_server'

export const headers = { authorization: 'Bearer ' + process.env.NOTES_API_KEY }
export const appClient = treaty<App>('http://127.0.0.1:21024')
