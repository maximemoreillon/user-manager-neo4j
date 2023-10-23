import { RedisClientType, createClient } from "redis"

export const { REDIS_URL } = process.env

let client: RedisClientType

export const init = async () => {
  if (!REDIS_URL) {
    console.log(`[Cache] REDIS_URL not set, skipping`)
    return
  }

  console.log(`[Cache] Using redis at ${REDIS_URL}`)

  client = createClient({ url: REDIS_URL })

  client.on("error", (err) => console.log("Redis Client Error", err))

  await client.connect()
}

export const getUserFromCache = async (user_id: string) => {
  if (!client) return
  const userFromCache = await client.get(`user:${user_id}`)
  if (!userFromCache) return
  return { ...JSON.parse(userFromCache), cached: true }
}

export const setUserInCache = async (user: any) => {
  if (!client) return
  await client.set(`user:${user._id}`, JSON.stringify(user), {
    EX: 60 * 60 * 12,
  })
}

export const removeUserFromCache = async (user_id: string) => {
  if (!client) return
  await client.del(`user:${user_id}`)
}
