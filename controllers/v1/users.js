const {driver} = require('../../db.js')
const dotenv = require('dotenv')
const newUserSchema = require('../../schemas/newUser.js')
const passwordUpdateSchema = require('../../schemas/passwordUpdate.js')
const {
  get_current_user_id,
  error_handling,
  compare_password,
  hash_password,
  user_query,
  user_id_filter,

} = require('../../utils.js')

dotenv.config()

function self_only_unless_admin(req, res){

  // This is a bit weird

  // Todo: error message if user is not admin and tries to edit another user

  const current_user_is_admin = !!res.locals.user.properties.isAdmin

  if(current_user_is_admin) {
    return req.body.user_id
      ?? req.query.user_id
      ?? req.params.user_id
      ?? res.locals.user._id // future proofing
      ?? res.locals.user.properties._id
      ?? res.locals.user.identity.low
      ?? res.locals.user.identity
  }
  else {
    return res.locals.user._id // future proofing
      ?? res.locals.user.properties._id
      ?? res.locals.user.identity.low
      ?? res.locals.user.identity
  }

}


function get_user_id_from_query_or_own(req, res){
  let {user_id} = req.params
  if(user_id === 'self') user_id = get_current_user_id(res)
  return user_id
}

const find_user_in_db = (identifier) => new Promise ( (resolve, reject) => {
  // This would maybe be better without throwing errors when user not found
  const session = driver.session()
  session.run(`
    MATCH (user:User)

    // Allow user to identify using either userrname or email address
    WHERE user.username = $identifier
      OR user.email_address=$identifier
      OR user._id = $identifier
      //OR id(user) = toInteger($identifier) // <= Removed query using identity

    // Return user if found
    RETURN user
    `, { identifier })
  .then(result => {

    if(!result.records.length) return reject({code: 400, message: `User ${identifier} not found`, tag: 'Neo4J'})
    if(result.records.length > 1) return reject({code: 500, message: `Multiple users found`, tag: 'Neo4J'})

    const user = result.records[0].get('user')

    resolve(user)
  })
  .catch(error => { reject({code: 500, message:error}) })
  .finally( () => session.close())

})


exports.get_user = async (req, res) => {

  try {
    const user_id = get_user_id_from_query_or_own(req, res)
    const user = await find_user_in_db(user_id)
    delete user.properties.password_hashed
    res.send(user)
    console.log(`[Neo4J] USer ${user_id} queried`)
  }
  catch (error) {
    error_handling(error, res)
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
    } catch (error) {
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
      RETURN $user_id
      `

    const {records} = await session.run(query, { user_id })

    if(!records.length) throw {code: 403, message: `User ${user_id} deletion failed`, tag: 'Neo4J'}

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

    const user_id = self_only_unless_admin(req, res)
    const properties = req.body
    const current_user = res.locals.user

    // Only allow certain properties to be edited
    let customizable_fields = [
      'avatar_src',
      'last_name',
      'display_name',
      'email_address',
      'first_name',
    ]

    if(current_user.properties.isAdmin){
      customizable_fields= customizable_fields.concat([
        'isAdmin',
        'locked',
      ])
    }

    for (let [key, value] of Object.entries(properties)) {
      if(!customizable_fields.includes(key)) {
        console.log(`Unauthorized attempt to modify property ${key}`)
        return res.status(403).send(`Unauthorized to modify ${key}`)
      }
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

      // Set the new password
      SET user.password_hashed = $password_hashed
      SEt user.password_changed = true

      // Return user once done
      RETURN user
      `

    const params = { user_id, password_hashed }

    const {records} = await session.run(query, params)

    if(!records.length) throw 'User not found'
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

exports.create_admin_if_not_exists = async () => {

  console.log(`[Neo4J] Creating admin account...`)

  const {
    ADMIN_USERNAME: default_admin_username = 'admin',
    ADMIN_PASSWORD: default_admin_password = 'admin',
  } = process.env

  const session = driver.session()

  return hash_password(default_admin_password)
  .then(default_admin_password_hashed => {

    const query = `
      // Create a dummy node so that the administrator account does not get ID 0
      MERGE (dummy:DummyNode)

      // Find the administrator account or create it if it does not exist
      MERGE (administrator:User {username: $default_admin_username})

      // Make the administrator an actual admin
      SET administrator.isAdmin = true

      // Check if the administrator account is missing its password
      // If the administrator account does not have a password (newly created), set it
      WITH administrator
      WHERE NOT EXISTS(administrator.password_hashed)
      SET administrator.password_hashed = $default_admin_password_hashed
      SET administrator.display_name = 'Administrator'

      // Return the account
      RETURN 'OK'
      `

    const params = {
      default_admin_password_hashed,
      default_admin_username,
    }

    return session.run(query, params)

  })
  .then(({records}) => {
    if(records.length > 0) console.log(`[Neo4J] Administrator account created`)
    else console.log(`[Neo4J] Administrator already existed`)
  })
  .catch(error => {
    // Retry admin creation later if Neo$j was not available
    if(error.code === 'ServiceUnavailable') {
      console.log(`[Neo4J] Neo4J unavailable, retrying in 10 seconds`)
      setTimeout(exports.create_admin_if_not_exists, 10000)
    }

    else console.log(error)
  })
  .finally( () => session.close())
}

exports.find_user_in_db = find_user_in_db