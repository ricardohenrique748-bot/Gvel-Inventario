import { MongoClient, Db, GridFSBucket } from 'mongodb'

const uri = process.env.MONGODB_URI
if (!uri) throw new Error('MONGODB_URI não definido no .env')

const client = new MongoClient(uri)
let db: Db | undefined

export async function connectDb() {
  await client.connect()
  db = client.db('gvel_diesel')
  return db
}

export function getDb() {
  if (!db) throw new Error('DB ainda não conectado — chame connectDb() primeiro')
  return db
}

// Toda coleção usa string UUID como _id (gerado com randomUUID), nunca ObjectId —
// esse alias evita que o driver infira _id: ObjectId por padrão em cada chamada.
export type MongoDoc = Record<string, any> & { _id: string }

export function col(name: string) {
  return getDb().collection<MongoDoc>(name)
}

export type BucketName = 'fotos-inspecao' | 'assinaturas'

export function getBucket(bucketName: BucketName) {
  return new GridFSBucket(getDb(), { bucketName })
}
