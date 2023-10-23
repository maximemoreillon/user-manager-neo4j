import createHttpError from "http-errors"
import { driver } from "../db"
import { user_query } from "../utils/users"
import { hash_password } from "../utils/passwords"
import {
  newUserSchema,
  userUpdateSchema,
  userAdminUpdateSchema,
} from "../schemas/users"
import { Response, Request, NextFunction } from "express"
import { getUserFromCache, setUserInCache, removeUserFromCache } from "../cache"

export const create_user = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  const session = driver.session()

  try {
    const current_user = res.locals.user
    // Currently, only admins can create accounts
    if (!current_user.isAdmin)
      throw createHttpError(403, `Only administrators can create users`)

    const properties = req.body

    try {
      await newUserSchema.validateAsync(properties)
    } catch (error) {
      throw createHttpError(400, error as any)
    }

    const { username, password, email_address, display_name } = properties

    const password_hashed = await hash_password(password)

    const query = `
      CREATE (user:User)

      // Set properties
      SET user += $user_properties
      SET user._id = randomUUID()
      SET user.creation_date = date()

      // For now, activated is true by default
      SET user.activated = true

      // Return the user
      RETURN properties(user) as user
      `

    const user_properties = {
      username,
      email_address,
      password_hashed,
      display_name: display_name || username || email_address,
    }

    const { records } = await session.run(query, { user_properties })

    const user = records[0].get("user")
    delete user.password_hashed

    console.log(`[Neo4J] User ${user._id} created`)
    res.send(user)
  } catch (error) {
    next(error)
  } finally {
    session.close()
  }
}

export const read_users = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  const session = driver.session()

  try {
    const {
      search,
      ids,
      limit = 100,
      skip = 0,
      order,
      sort,
      ...filters
    } = req.query

    const search_query = `
      // Make a list of the keys of each node
      // Additionally, filter out fields that should not be searched
      WITH [key IN KEYS(user) WHERE NOT key IN $exceptions] AS keys

      // Unwinding all searchable keys
      UNWIND keys as key

      // Filter nodes by looking for properties
      WITH key
      // NOTE: This overrides previous MATCH
      OPTIONAL MATCH (user:User)
      WHERE toLower(toString(user[key])) CONTAINS toLower($search)
      `

    const filtering_query = `
      UNWIND KEYS($filters) as filterKey
      WITH filterKey
      // NOTE: This overrides previous MATCH
      OPTIONAL MATCH (user:User)
      WHERE user[filterKey] = $filters[filterKey]
      `

    const ids_query = `
      UNWIND $ids as id
      // This WITH is needed to isolate from previous MATCH
      WITH id
      // NOTE: This overrides previous MATCH
      OPTIONAL MATCH (user:User {_id: id})
      `

    const query = `

      OPTIONAL MATCH (user:User)
      ${search ? search_query : ""}
      ${Object.keys(filters).length ? filtering_query : ""}
      ${ids ? ids_query : ""}

      // Aggregation
      WITH
        COLLECT(DISTINCT PROPERTIES(user)) as users,
        COUNT(DISTINCT user) as count,
        toInteger($skip) as skip,
        toInteger($limit) as limit,
        (toInteger($skip)+toInteger($limit)) as end_index

      // Batching
      RETURN
        count,
        users[skip..end_index] AS users,
        skip,
        limit
      `

    const parameters = {
      search,
      exceptions: ["password_hashed", "_id", "avatar_src"],
      ids,
      skip,
      limit,
      filters,
    }

    const { records } = await session.run(query, parameters)

    const record = records[0]

    // Would be better to return 200 with an exmpty set...
    if (!record) throw createHttpError(500, `Query did not return any record`)

    const users = record.get("users")

    // Delete passwords from users
    users.forEach((user: any) => {
      delete user.password_hashed
    })

    const response = {
      limit: record.get("limit"),
      skip: record.get("skip"),
      count: record.get("count"),
      users,
    }

    res.send(response)
  } catch (error) {
    next(error)
  } finally {
    session.close()
  }
}

export const read_user = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  let { user_id } = req.params
  if (user_id === "self") return res.send(res.locals.user)
  if (!user_id) throw createHttpError(400, `User ID not defined`)

  let user = await getUserFromCache(user_id)

  if (user) {
    delete user.password_hashed
    return res.send(user)
  }

  const session = driver.session()

  try {
    const query = `
      ${user_query}
      RETURN properties(user) as user
      `
    const { records } = await session.run(query, { user_id })

    if (!records.length) throw createHttpError(404, `User ${user_id} not found`)

    user = records[0].get("user")
    setUserInCache(user)
    delete user.password_hashed
    user.cached = false
    res.send(user)
  } catch (error) {
    next(error)
  } finally {
    session.close()
  }
}

export const update_user = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  const session = driver.session()

  try {
    const current_user = res.locals.user
    const current_user_id = current_user._id
    const user_is_admin = res.locals.user.isAdmin

    let { user_id } = req.params
    if (user_id === "self") user_id = current_user_id

    // Prevent an user from modifying another's password
    if (String(user_id) !== String(current_user_id) && !user_is_admin) {
      throw createHttpError(403, `Unauthorized to modify another user`)
    }

    const properties = req.body

    try {
      if (user_is_admin) await userAdminUpdateSchema.validateAsync(properties)
      else await userUpdateSchema.validateAsync(properties)
    } catch (error: any) {
      throw createHttpError(403, error)
    }

    const query = `
      ${user_query}
      SET user += $properties // += implies update of existing properties
      RETURN user
      `

    const parameters = { user_id, properties }

    const { records } = await session.run(query, parameters)

    if (!records.length) throw createHttpError(404, `User ${user_id} not found`)

    const { properties: user } = records[0].get("user")
    delete user.password_hashed

    console.log(`[Neo4J] User ${user_id} updated`)
    removeUserFromCache(user_id)
    res.send(user)
  } catch (error) {
    next(error)
  } finally {
    session.close()
  }
}

export const delete_user = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  const session = driver.session()

  try {
    const current_user = res.locals.user
    const current_user_id = current_user._id

    // Prevent normal users to create a user
    // TODO: allow users to delete self
    if (!current_user.isAdmin) throw createHttpError(404, `Unauthorized`)

    let user_id = req.params.user_id
    if (user_id === "self") user_id = current_user_id

    const query = `
      ${user_query}
      DETACH DELETE user
      RETURN $user_id as user_id
      `

    const { records } = await session.run(query, { user_id })

    if (!records.length) throw createHttpError(404, `User ${user_id} not found`)

    console.log(`[Neo4J] User ${user_id} deleted`)
    removeUserFromCache(user_id)

    res.send({ user_id })
  } catch (error) {
    next(error)
  } finally {
    session.close()
  }
}
