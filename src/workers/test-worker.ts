import 'dotenv/config.js'
import { resolve } from '../../lib/workerLib'
import * as Minio from 'minio'

async function main() {
  const minioClient = new Minio.Client({
    endPoint:
      'axioqr1tqh1r.compat.objectstorage.ap-singapore-1.oraclecloud.com',
    useSSL: true,
    accessKey: process.env.OCI_ACCESS_KEY_ID!,
    secretKey: process.env.OCI_SECRET_ACCESS_KEY!,
  })
  await minioClient.putObject('dtinth-notes', 'test.txt', 'Hello World')
  resolve('ok')
}

main()
