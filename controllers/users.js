const createHttpError = require("http-errors")
const { driver } = require("../db.js")
const { user_query } = require("../utils/users.js")
const { hash_password } = require("../utils/passwords.js")
const {
  newUserSchema,
  userUpdateSchema,
  userAdminUpdateSchema,
} = require("../schemas/users.js")

function get_user_id_from_query_or_own(req, res) {
  let { user_id } = req.params
  if (user_id === "self") user_id = res.locals.user._id
  return user_id
}

exports.create_user = async (req, res, next) => {
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
      throw createHttpError(400, error)
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

exports.read_users = async (req, res, next) => {
  const session = driver.session()

  try {
    const {
      search,
      ids,
      batch_size = 100,
      start_index = 0,
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
      OPTIONAL MATCH (user:User)
      WHERE toLower(toString(user[key])) CONTAINS toLower($search)
      `

    const filtering_query = `
      WITH user
      UNWIND KEYS($filters) as filterKey
      WITH user
      WHERE user[filterKey] = $filters[filterKey]
      `

    const ids_query = `
      // Discarding previous queries
      WITH 1 as dummy

      UNWIND $ids as id
      OPTIONAL MATCH (user:User {_id: id})
      `

    const query = `

      MATCH (user:User)
      ${search ? search_query : ""}
      ${Object.keys(filters).length ? filtering_query : ""}
      ${ids ? ids_query : ""}

      // Aggregation
      WITH
        COLLECT(DISTINCT PROPERTIES(user)) as users,
        COUNT(DISTINCT user) as count,
        toInteger($start_index) as start_index,
        toInteger($batch_size) as batch_size,
        (toInteger($start_index)+toInteger($batch_size)) as end_index

      // Batching
      RETURN
        count,
        users[start_index..end_index] AS users,
        start_index,
        batch_size
      `

    const parameters = {
      search,
      exceptions: ["password_hashed", "_id", "avatar_src"],
      ids,
      start_index,
      batch_size,
    }

    const { records } = await session.run(query, parameters)

    const record = records[0]

    // Would be better to return 200 with an exmpty set...
    if (!record) throw createHttpError(500, `Query did not return any record`)

    const users = record.get("users")

    // Delete passwords from users
    users.forEach((user) => {
      delete user.password_hashed
    })

    const response = {
      batch_size: record.get("batch_size"),
      start_index: record.get("start_index"),
      count: record.get("count"),
      users,
    }
    console.log(`[Neo4j] Users queried`)

    res.send(response)
  } catch (error) {
    next(error)
  } finally {
    session.close()
  }
}

exports.read_user = async (req, res, next) => {
  const session = driver.session()

  try {
    const user_id = get_user_id_from_query_or_own(req, res)

    const query = `
      ${user_query}
      RETURN properties(user) as user
      `
    const { records } = await session.run(query, { user_id })

    if (!records.length) throw createHttpError(404, `User ${user_id} not found`)

    const user = records[0].get("user")

    console.log(`[Neo4J] User ${user_id} queried`)
    res.send(user)
  } catch (error) {
    next(error)
  } finally {
    session.close()
  }
}

exports.delete_user = async (req, res, next) => {
  const session = driver.session()

  try {
    const current_user = res.locals.user

    // Prevent normal users to create a user
    // TODO: allow users to delete self
    if (!current_user.isAdmin) throw createHttpError(404, `Unauthorized`)

    const user_id = req.params.user_id
    if (user_id === "self") user_id = get_current_user_id(res)

    const query = `
      ${user_query}
      DETACH DELETE user
      RETURN $user_id as user_id
      `

    const { records } = await session.run(query, { user_id })

    if (!records.length) throw createHttpError(404, `User ${user_id} not found`)

    console.log(`[Neo4J] User ${user_id} deleted`)
    res.send({ user_id })
  } catch (error) {
    next(error)
  } finally {
    session.close()
  }
}

exports.update_user = async (req, res, next) => {
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
    } catch (error) {
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

    res.send(user)
  } catch (error) {
    next(error)
  } finally {
    session.close()
  }
}
