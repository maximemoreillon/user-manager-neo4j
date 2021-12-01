const driver = require('../neo4j_driver.js')
const dotenv = require('dotenv')
const {
  error_handling,
  compare_password,
  hash_password,
} = require('../utils.js')

// Dotenv might not be necessary here
dotenv.config()

function self_only_unless_admin(req, res){

  // Todo: error message if user is not admin and tries to edit another user

  const current_user_is_admin = !!res.locals.user.properties.isAdmin

  if(current_user_is_admin) {
    return req.body.user_id
      ?? req.query.user_id
      ?? req.params.user_id
      ?? res.locals.user.identity.low
      ?? res.locals.user.identity
  }
  else {
    return res.locals.user.identity.low
      ?? res.locals.user.identity
  }

}

function get_current_user_id(res){
  return res.locals.user.identity
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
    WHERE user.username=$identifier
      OR user.email_address=$identifier
      OR id(user) = toInteger($identifier)

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

    const {username, password} = req.body

    if(!username) throw {code: 400, message: `Username not defined`, tag: 'Express'}
    if(!password) throw {code: 400, message: `Password not defined`, tag: 'Express'}

    const password_hashed = await hash_password(password)

    const query = `
      // MERGE the user node
      MERGE (user:User {username: $username})

      // If the user does not have a password, i.e. does not exist
      // Prevent further execution
      WITH user
      WHERE NOT EXISTS(user.password_hashed)

      // Set properties
      SET user.password_hashed = $password_hashed
      SET user.display_name = $username

      // Return the user
      RETURN user
      `

    const params = {
      username,
      password_hashed
    }

    const {records} = await session.run(query, params)

    // No record implies that the user already existed
    if(!records.length) throw {code: 403, message: `User ${username} already exists`, tag: 'Neo4J'}

    const user = records[0].get('user')
    console.log(`[Neo4J] User ${user.properties.username} (ID ${user.identity}) created`)
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

    const user_id = req.params.user_id
    if(user_id === 'self') user_id = get_current_user_id(res)

    const query = `
      // Find the user
      MATCH (user:User)
      WHERE id(user) = toInteger($user_id)

      // Delete
      DETACH DELETE user

      // Return something
      RETURN 'success'
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
      MATCH (user:User)
      WHERE id(user) = toInteger($user_id)
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

    const {new_password, new_password_confirm, current_password} = req.body

    if(!new_password) throw {code: 403, message: `New password not defined`, tag: 'Express'}
    if(!new_password_confirm) throw {code: 403, message: `New password confirm not defined`, tag: 'Express'}

    // TOdo: password confirm check

    // Get current user ID
    const current_user_id = self_only_unless_admin(req, res)

    // Retrieve user ID
    let user_id = req.params.user_id
    if(user_id === 'self') user_id = current_user_id

    const user_is_admin = res.locals.user.properties.isAdmin

    // Prevent an user from modifying another's password
    if(String(user_id) !== String(current_user_id) && !user_is_admin) {
      return res.status(403).send(`Unauthorized to modify another user's password`)
    }

    // Only allow admins to set password without checking the current password
    if(!user_is_admin && !current_password) {
      return res.status(400).send(`Current password missing`)
    }

    const user_find_query = `
      // Find the user using ID
      MATCH (user:User)
      WHERE id(user) = toInteger($user_id)

      // Return user once done
      RETURN user.password_hashed as password
      `

    const {records: user_records} = await session.run(user_find_query, { user_id })

    if(user_records.length < 1) throw {code: 404, message: `User ${user_id} not found`, tag: 'Neo4J'}

    const current_password_hashed = user_records[0].get('password')

    const password_matching = await compare_password(current_password, current_password_hashed)
    if(!password_matching && !user_is_admin) throw {code: 403, message: `Current password incorrect`, tag: 'Auth'}

    const password_hashed = await hash_password(new_password)

    const password_update_query = `
      // Find the user using ID
      MATCH (user:User)
      WHERE id(user) = toInteger($user_id)

      // Set the new password
      SET user.password_hashed = $password_hashed
      SEt user.password_changed = true

      // Return user once done
      RETURN user
      `

    const {records: password_update_records} = await session.run(password_update_query, { user_id, password_hashed })

    if(!password_update_records.length) throw 'User not found'
    const user = password_update_records[0].get('user')
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
      WHERE id(user)=toInteger(id)
      `
    }

    const query = `
      MATCH (user:User)

      ${search_query}
      ${ids_query}

      RETURN DISTINCT user

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

exports.delete_all_users = () => {
  const session = driver.session()
  const query = `
    MATCH (user:User)
    DETACH DELETE user
    `
  return session.run(query)
  .then( () => { console.log(`[Neo4J] all users deleted`) })
  .catch(error => { console.log(error) })
  .finally( () => session.close())

}

exports.find_user_in_db = find_user_in_db
