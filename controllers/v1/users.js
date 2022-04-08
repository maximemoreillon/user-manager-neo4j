const {driver} = require('../../db.js')
const dotenv = require('dotenv')
const { passwordUpdateSchema } = require('../../schemas/passwords.js')
const {
  newUserSchema,
  userUpdateSchema,
  userAdminUpdateSchema
  } = require('../../schemas/users.js')
const {
  get_current_user_id,
  error_handling,
  compare_password,
  hash_password,
  user_query,
  user_id_filter,
  find_user_by_id,
} = require('../../utils.js')

dotenv.config()


function self_only_unless_admin(req, res){

  // THIS NEEDS A REVIEW

  const current_user_is_admin = !!res.locals.user.properties.isAdmin

  if(current_user_is_admin) {
    return req.body.user_id
      ?? req.query.user_id
      ?? req.params.user_id
      ?? res.locals.user.properties._id
  }
  else {
    res.locals.user.properties._id
  }
}


function get_user_id_from_query_or_own(req, res){
  let {user_id} = req.params
  if(user_id === 'self') user_id = get_current_user_id(res)
  return user_id
}


exports.get_user = async (req, res) => {

  const session = driver.session()

  try {
    const user_id = get_user_id_from_query_or_own(req, res)

    const query = `${user_query} RETURN user`

    const {records} = await session.run(query, {user_id})

    if(!records.length) throw {code: 404, message: `User ${user_id} not found`}

    const user = records[0].get('user')

    console.log(`[Neo4J] USer ${user_id} queried`)
    res.send(user)
  }
  catch (error) {
    error_handling(error, res)
  }
  finally {
    session.close()
  }
}

exports.create_user = async (req, res) => {

  const session = driver.session()

  try {
    // Currently, only admins can create accounts
    if(!res.locals.user.properties.isAdmin){
      throw {code: 403, message: `Only administrators can create users`, tag: 'Auth'}
    }

    const properties = req.body

    try {
      await newUserSchema.validateAsync(properties)
    }
    catch (error) {
      throw {code: 400, message: error}
    }

    const {
      username,
      password,
      email_address,
    } = properties


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

      // Return the user
      RETURN user
      `

    const params = { username, password_hashed }

    const {records} = await session.run(query, params)




    // No record implies that the user already existed
    if(!records.length) throw {code: 403, message: `User ${username} already exists`, tag: 'Neo4J'}

    const user = records[0].get('user')
    console.log(`[Neo4J] User ${username} created`)
    res.send(user)

  }
  catch (error) {
    error_handling(error, res)
  }
  finally {
    session.close()
  }

}

exports.delete_user = async (req, res) => {

  const session = driver.session()

  try {

    const current_user = res.locals.user


    // Prevent normal users to create a user
    // TODO: allow users to delete self
    if(!current_user.properties.isAdmin){
      throw {code: 403, message: 'Unauthorized'}
    }

    const user_id = req.params.user_id
    if(user_id === 'self') user_id = get_current_user_id(res)

    const query = `
      ${user_query}
      DETACH DELETE user
      RETURN $user_id as user_id
      `

    const {records} = await session.run(query, { user_id })

    if(!records.length) throw {code: 404, message: `User ${user_id} not found`, tag: 'Neo4J'}

    console.log(`[Neo4J] User ${user_id} deleted`)
    res.send({user_id})

  }
  catch (error) {
    error_handling(error, res)
  }
  finally {
    session.close()
  }

}

exports.patch_user = async (req, res) => {

  const session = driver.session()

  try {

    const current_user = res.locals.user
    const current_user_id = current_user.properties._id
    const user_is_admin = res.locals.user.properties.isAdmin

    let {user_id} = req.params
    if(user_id === 'self') user_id = current_user_id

    // Prevent an user from modifying another's password
    if(String(user_id) !== String(current_user_id) && !user_is_admin) {
      return res.status(403).send(`Unauthorized to modify another user`)
    }

    const properties = req.body

    try {
      if(user_is_admin) await userAdminUpdateSchema.validateAsync(properties)
      else await userUpdateSchema.validateAsync(properties)
    }
    catch (error) {
      throw {code: 403, mesage: error.message, tag: 'Joi'}
    }


    const query = `
      ${user_query}
      SET user += $properties // += implies update of existing properties
      RETURN user
      `

    const parameters = { user_id, properties }

    const {records} = await session.run(query,parameters)

    if(!records.length) throw {code: 404, mesage: `User ${user_id} not found`, tag: 'Neo4J'}

    const user = records[0].get('user')

    // Remove password in response
    delete user.properties.password_hashed

    console.log(`[Neo4J] User ${user_id} updated`)

    res.send(user)

  }
  catch (error) {
    error_handling(error, res)
  }
  finally {
    session.close()
  }

}

exports.update_password = async (req, res) => {

  const session = driver.session()

  try {


    try {
      await passwordUpdateSchema.validateAsync(req.body)
    } catch (error) {
      throw {code: 400, message: error}
    }

    const {new_password, new_password_confirm} = req.body

    // Get current user info
    const {user_id} = req.params
    const current_user_id = res.locals.user.properties._id
    const user_is_admin = res.locals.user.properties.isAdmin

    // Prevent an user from modifying another's password
    if(String(user_id) !== String(current_user_id) && !user_is_admin) {
      return res.status(403).send(`Unauthorized to modify another user's password`)
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

    if(!records.length) throw `User ${user_id} not found`

    const user = records[0].get('user')
    delete user.properties.password_hashed
    console.log(`[Neo4J] Password of user ${user_id} updated`)
    res.send(user)

  }
  catch (error) {
    error_handling(error, res)
  }
  finally {
    session.close()
  }



}

exports.get_users = async (req, res) => {

  const session = driver.session()

  try {

    let search_query = ''
    if(req.query.search) {
      search_query = `
      // Make a list of the keys of each node
      // Additionally, filter out fields that should not be searched
      WITH [key IN KEYS(user) WHERE NOT key IN $exceptions] AS keys, user

      // Unwinding
      UNWIND keys as key

      // Filter nodes by looking for properties
      WITH key, user
      WHERE toLower(toString(user[key])) CONTAINS toLower($search)
      `
    }

    let ids_query = ''
    if(req.query.ids) {
      search_query = `
      WITH user

      // Unwinding
      UNWIND $ids as id
      WITH id, user
      WHERE user._id = toString(id)
      `
    }

    const query = `
      MATCH (user:User)

      ${search_query}
      ${ids_query}

      RETURN DISTINCT user

      // TODO: BATCHING


      LIMIT 100
      `

    const parameters = {
        search: req.query.search,
        exceptions: [ 'password_hashed' ],
        ids: req.query.ids,
      }

    const {records} = await session.run(query, parameters)

    const users = records.map(record => record.get('user'))
    users.forEach( user => { delete user.properties.password_hashed })

    res.send( users )
    console.log(`[Neo4j] Users queried`)


  }
  catch (error) {
    error_handling(error, res)
  }
  finally {
    session.close()
  }

}

const create_admin_if_not_exists = async () => {

  console.log(`[Neo4J] Creating admin account`)

  const session = driver.session()

  try {
    const {
      DEFAULT_ADMIN_USERNAME: admin_username = 'admin',
      DEFAULT_ADMIN_PASSWORD: admin_password = 'admin',
    } = process.env


    const password_hashed = await hash_password(admin_password)

    const query = `
      // Find the administrator account or create it if it does not exist
      MERGE (administrator:User {username:$admin_username})

      // Check if the administrator account is missing its password
      // If the administrator account does not have a password (newly created), set it
      WITH administrator
      WHERE NOT EXISTS(administrator.password_hashed)
      SET administrator.password_hashed = $password_hashed
      SET administrator._id = randomUUID() // THIS IS IMPORTANT
      SET administrator.isAdmin = true

      // Set some additional properties
      SET administrator.display_name = 'Administrator'

      // Return the account
      RETURN administrator
      `

    const {records} = await session.run(query, { admin_username, password_hashed })

    if(records.length) console.log(`[Neo4J] Admin creation: admin account created`)
    else console.log(`[Neo4J] Admin creation: admin already existed`)



  } catch (error) {

    console.log(`[Neo4J] Admin creation failed, retrying in 10s...`, error)
    setTimeout(create_admin_if_not_exists, 10000)

  } finally {
    session.close()
  }
}

exports.create_admin_if_not_exists = create_admin_if_not_exists
