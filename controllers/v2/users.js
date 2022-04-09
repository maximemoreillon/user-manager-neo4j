const createHttpError = require('http-errors')
const dotenv = require('dotenv')
const { driver } = require('../../db.js')
const { passwordUpdateSchema } = require('../../schemas/passwords.js')
const {
  newUserSchema,
  userUpdateSchema,
  userAdminUpdateSchema
} = require('../../schemas/users.js')

const {
  compare_password,
  hash_password,
  user_query,
  user_id_filter,
  find_user_by_id,
} = require('../../utils.js')

dotenv.config()

function self_only_unless_admin(req, res){

  const current_user = res.locals.user

  const current_user_is_admin = !!current_user.isAdmin

  if(current_user_is_admin) {
    return req.body.user_id
      ?? req.query.user_id
      ?? req.params.user_id
      ?? current_user._id

  }
  else {
    return current_user._id
  }
}


function get_user_id_from_query_or_own(req, res){
  let {user_id} = req.params
  if(user_id === 'self') user_id = res.locals.user._id
  return user_id
}


exports.get_user = async (req, res, next) => {

  const session = driver.session()

  try {
    const user_id = get_user_id_from_query_or_own(req, res)

    const query = `
      ${user_query}
      RETURN properties(user) as user
      `
    const {records} = await session.run(query, {user_id})

    if(!records.length) throw createHttpError(404, `User ${user_id} not found`)

    const user = records[0].get('user')

    console.log(`[Neo4J] User ${user_id} queried`)
    res.send(user)
  }
  catch (error) {
    next(error)
  }
  finally {
    session.close()
  }
}

exports.create_user = async (req, res, next) => {

  const session = driver.session()

  try {
    // Currently, only admins can create accounts
    if(!res.locals.user.isAdmin) throw createHttpError(403, `Only administrators can create users`)

    const properties = req.body

    try {
      await newUserSchema.validateAsync(properties)
    }
    catch (error) {
      throw createHttpError(400, error)
    }

    const { username, password, email_address } = properties


    const password_hashed = await hash_password(password)

    const query = `
      // MERGE the user node with username as unique
      MERGE (user:User {username: $username})

      // if the user does not have a uuid, it means the user has not been registered
      // if the user exists, then further execution will be stopped
      WITH user
      WHERE NOT EXISTS(user._id)

      // Set properties
      SET user._id = randomUUID()
      SET user.password_hashed = $password_hashed
      SET user.display_name = $username
      SET user.creation_date = date()
      SET user.activated = true

      // Return the user
      RETURN user
      `

    // WARNING: email_address is ignored
    const params = { username, password_hashed }

    const {records} = await session.run(query, params)

    // No record implies that the user already existed
    if(!records.length) throw createHttpError(400, `User ${username} already exists`)

    const { properties: user } = records[0].get('user')
    delete user.password_hashed

    console.log(`[Neo4J] User ${username} created`)
    res.send(user)

  }
  catch (error) {
    next(error)
  }
  finally {
    session.close()
  }

}

exports.delete_user = async (req, res, next) => {

  const session = driver.session()

  try {

    const current_user = res.locals.user


    // Prevent normal users to create a user
    // TODO: allow users to delete self
    if(!current_user.isAdmin) throw createHttpError(404, `Unauthorized`)

    const user_id = req.params.user_id
    if(user_id === 'self') user_id = get_current_user_id(res)

    const query = `
      ${user_query}
      DETACH DELETE user
      RETURN $user_id as user_id
      `

    const {records} = await session.run(query, { user_id })

    if(!records.length) throw createHttpError(404, `User ${user_id} not found`)

    console.log(`[Neo4J] User ${user_id} deleted`)
    res.send({user_id})

  }
  catch (error) {
    next(error)
  }
  finally {
    session.close()
  }

}

exports.patch_user = async (req, res, next) => {

  const session = driver.session()

  try {

    const current_user = res.locals.user
    const current_user_id = current_user._id
    const user_is_admin = res.locals.user.isAdmin

    let {user_id} = req.params
    if(user_id === 'self') user_id = current_user_id

    // Prevent an user from modifying another's password
    if(String(user_id) !== String(current_user_id) && !user_is_admin) {
      throw createHttpError(403, `Unauthorized to modify another user`)
    }

    const properties = req.body

    try {
      if(user_is_admin) await userAdminUpdateSchema.validateAsync(properties)
      else await userUpdateSchema.validateAsync(properties)
    }
    catch (error) {
      throw createHttpError(403, error)
    }


    const query = `
      ${user_query}
      SET user += $properties // += implies update of existing properties
      RETURN user
      `

    const parameters = { user_id, properties }

    const {records} = await session.run(query,parameters)

    if(!records.length) throw createHttpError(404, `User ${user_id} not found`)

    const { properties:user } = records[0].get('user')
    delete user.password_hashed

    console.log(`[Neo4J] User ${user_id} updated`)

    res.send(user)

  }
  catch (error) {
    next(error)
  }
  finally {
    session.close()
  }

}

exports.update_password = async (req, res, next) => {

  const session = driver.session()

  try {


    try {
      await passwordUpdateSchema.validateAsync(req.body)
    }
    catch (error) {
      throw createHttpError(400, error.message)
    }

    const {new_password, new_password_confirm} = req.body

    // Get current user info
    let {user_id} = req.params
    const current_user_id = res.locals.user._id
    if(user_id === 'self') user_id = current_user_id
    const user_is_admin = res.locals.user.isAdmin

    // Prevent an user from modifying another's password
    if(String(user_id) !== String(current_user_id) && !user_is_admin) {
      throw createHttpError(403, `Unauthorized to modify another user's password`)
    }


    const password_hashed = await hash_password(new_password)

    const query = `
      ${user_query}
      SET user.password_hashed = $password_hashed
      SET user.password_changed = true
      RETURN user
      `

    const params = { user_id, password_hashed }

    const {records} = await session.run(query, params)

    if(!records.length) throw createHttpError(404, `User ${user_id} not found`)

    const {properties:user} = records[0].get('user')
    delete user.password_hashed
    console.log(`[Neo4J] Password of user ${user_id} updated`)
    res.send(user)

  }
  catch (error) {
    next(error)
  }
  finally {
    session.close()
  }



}

exports.get_users = async (req, res, next) => {

  const session = driver.session()

  try {

    const {
      search,
      ids,
      batch_size = 100,
      start_index = 0,
    } = req.query


    const search_query = `
      // Make a list of the keys of each node
      // Additionally, filter out fields that should not be searched
      WITH [key IN KEYS(user) WHERE NOT key IN $exceptions] AS keys, user

      // Unwinding
      UNWIND keys as key

      // Filter nodes by looking for properties
      WITH key, user
      WHERE toLower(toString(user[key])) CONTAINS toLower($search)
      `


    const ids_query = `
      // Making a clear transition from previous queries
      WITH 1 as dummy
      UNWIND $ids as id
      OPTIONAL MATCH (user:User {_id: id})
      `


    const query = `

      MATCH (user:User)
      ${search ? search_query : ''}
      ${ids ? ids_query : ''}


      // Aggregation
      WITH
        COLLECT(DISTINCT properties(user)) as users,
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
        exceptions: [ 'password_hashed', '_id', 'avatar_src'],
        ids,
        start_index,
        batch_size
      }

    const {records} = await session.run(query, parameters)

    const record = records[0]
    
    // Would be better to return 200 with an exmpty set...
    if(!record) throw createHttpError(404, `No user found`)

    const users = record.get('users')

    // Delete passwords from users
    users.forEach(user => { delete user.password_hashed })

    const response =  {
      batch_size: record.get('batch_size'),
      start_index: record.get('start_index'),
      count: record.get('count'),
      users,
    }
    console.log(`[Neo4j] Users queried`)

    res.send(response)
  }
  catch (error) {
    next(error)
  }
  finally {
    session.close()
  }

}
