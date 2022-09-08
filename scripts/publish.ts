import 'dotenv/config'
import secrets from '../secrets'
import axios from 'axios'

async function main() {
  const key = secrets.apiToken
  const url = `http://localhost:21001/v2/publish`
  const { data } = await axios.post(
    url,
    {},
    { headers: { Authorization: `Bearer ${key}` } }
  )
  console.log(data)
}

main()
