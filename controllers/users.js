const driver = require('../neo4j_driver.js')
const bcrypt = require('bcrypt')
const dotenv = require('dotenv')

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
  let user_id = req.params.user_id

  if(user_id === 'self') user_id = get_current_user_id(res)

  return user_id
}

function hash_password(password_plain) {
  return new Promise ( (resolve, reject) => {
    bcrypt.hash(password_plain, 10, (error, password_hashed) => {
      if(error) return reject({code: 500, message: error})
      resolve(password_hashed)
      console.log(`[Bcrypt] Password hashed`)
    })
  })
}

function compare_password(password_plain, password_hashed){
  return new Promise( (resolve, reject) => {
    bcrypt.compare(password_plain, password_hashed, (error, result) => {
      if(error) return reject(error)
      resolve(result)
    })
  })
}



exports.get_user = (req, res) => {

  const user_id = get_user_id_from_query_or_own(req, res)

  const session = driver.session()
  session
  .run(`
    MATCH (user:User)
    WHERE id(user) = toInteger($user_id)
    RETURN user
    `, {
    user_id
  })
  .then( ({records}) => {

    if(!records.length) {
      console.log(`[neo4J] User ${user_id} not found`)
      return res.status(404).send(`User ${user_id} not found`)
    }

    const user = records[0].get('user')
    delete user.properties.password_hashed

    res.send(user)
    console.log(`[Neo4J] USer ${user_id} queried`)
  })
  .catch(error => {
    console.log(error)
    res.status(500).send(`Error getting users: ${error}`)
  })
  .finally(() => session.close())
}

exports.create_user = (req, res) => {

  if(!res.locals.user.properties.isAdmin){
    console.log(`[Express] Unauthorized attempt to create a user`)
    return res.status(403).send(`Only administrators can create users`)
  }

  const {username, password} = req.body
  if(!username) {
    console.log(`[Express] userrname not defined`)
    return res.status(400).send(`username not defined`)
  }

  if(!password) {
    console.log(`[Express] password not defined`)
    return res.status(400).send(`password not defined`)
  }

  const session = driver.session()

  hash_password(password)
  .then(password_hashed => {

    const query = `
      // create the user node
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

    return session.run(query, params)
  })
  .then( ({records}) => {

    if(!records.length) {
      console.log(`[Neo4J] Failed attempt at creating duplicate user ${username}`)
      return res.status(400).send(`User ${username} already exists`)
    }

    const user = records[0].get('user')
    console.log(`[Neo4J] User ${user.properties.username} (ID ${user.identity}) created`)
    res.send(user)
  })
  .catch(error => {
    console.log(error)
    res.status(500).send(`Error creating user: ${error}`)
   })
  .finally(() => session.close())

}

exports.delete_user = (req, res) => {

  const user_id = req.params.user_id
    ?? req.query.user_id
    ?? req.query.id
    // DO NOT PUT CURRENT USER HERE

  if(user_id === 'self') user_id = get_current_user_id(res)


  const session = driver.session()
  session
  .run(`
    // Find the user
    MATCH (user:User)
    WHERE id(user) = toInteger($user_id)

    // Delete
    DETACH DELETE user

    // Return something
    RETURN 'success'
    `, {
    user_id
  })
  .then(({records}) => {

    if(!records.length) {
      console.log(`[neo4J] User ${user_id} deletion failed`)
      return res.status(404).send(`User ${user_id} deletion failed`)
    }

    res.send("User deleted successfully")
  })
  .catch(error => {
    console.error(error)
    res.status(500).send(`Error deleting user: ${error}`)
  })
  .finally(() => session.close())
}

exports.patch_user = (req, res) => {

  const user_id = self_only_unless_admin(req, res)

  let customizable_fields = [
    'avatar_src',
    'last_name',
    'display_name',
    'email_address',
    'first_name',
  ]

  if(res.locals.user.properties.isAdmin){
    customizable_fields= customizable_fields.concat([
      'isAdmin',
      'locked',
    ])
  }

  for (let [key, value] of Object.entries(req.body)) {
    if(!customizable_fields.includes(key)) {
      console.log(`Unauthorized attempt to modify property ${key}`)
      return res.status(403).send(`Unauthorized to modify ${key}`)
    }
  }

  const session = driver.session()
  session
  .run(`
    MATCH (user:User)
    WHERE id(user) = toInteger($user_id)
    SET user += $properties // += implies update of existing properties
    RETURN user
    `, {
    user_id,
    properties: req.body,
  })
  .then( ({records}) => {

    if(!records.length) {
      console.log(`[neo4J] User ${user_id} not found`)
      return res.status(404).send(`User ${user_id} not found`)
    }

    const user = records[0].get('user')
    delete user.properties.password_hashed
    res.send(user)
    console.log(`[Neo4J] User ${user_id} updated`)
  })
  .catch(error => { res.status(500).send(`Error updating property: ${error}`) })
  .finally(() => session.close())



}

exports.update_password = (req, res) => {

  // Input sanitation
  const {new_password, new_password_confirm, current_password} = req.body

  if(!new_password) return res.status(400).send(`New nassword missing`)
  if(!new_password_confirm) return res.status(400).send(`New password confirm missing`)

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

  const session = driver.session()
  session.run(`
    // Find the user using ID
    MATCH (user:User)
    WHERE id(user) = toInteger($user_id)

    // Return user once done
    RETURN user.password_hashed as password
    `, { user_id })
  .then( ({records}) => {
    if(records.length < 1) throw 'User not found'
    const current_password_hashed = records[0].get('password')
    if(user_is_admin) return
    return compare_password(current_password, current_password_hashed)
  })
  .then(() => hash_password(new_password))
  .then(password_hashed => {
    return session.run(`
    // Find the user using ID
    MATCH (user:User)
    WHERE id(user) = toInteger($user_id)

    // Set the new password
    SET user.password_hashed = $password_hashed
    SEt user.password_changed = true

    // Return user once done
    RETURN user
    `, { user_id, password_hashed }
    )
  })
  .then(({records}) => {
    if(!records.length) throw 'User not found'
    const user = records[0].get('user')
    delete user.properties.password_hashed
    res.send(user)
    console.log(`[Neo4J] Password of user ${user_id} updated`)
   })
  .catch(error => {
    console.log(error)
    res.status(500).send(error)
  })
  .finally( () => session.close() )

}

exports.get_users = (req, res) => {

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

  const session = driver.session()
  session
  .run(`
    MATCH (user:User)

    ${search_query}
    ${ids_query}

    RETURN DISTINCT user

    LIMIT 100
    `, {
      search: req.query.search,
      exceptions: [ 'password_hashed' ],
      ids: req.query.ids,
    })
  .then(({records}) => {
    const users = records
      .map(record => record.get('user'))

    users.forEach( user => { delete user.properties.password_hashed })

    res.send( users )
    console.log(`[Neo4j] Users queried`)
  })
  .catch(error => {
    console.error(error)
    res.status(400).send(`Error accessing DB: ${error}`)
  })
  .finally( () => { session.close() })
}

exports.create_admin_if_not_exists = () => {

  console.log(`[Neo4J] Creating admin account...`)

  const default_admin_password = process.env.ADMIN_PASSWORD || 'admin'
  const default_admin_username = process.env.ADMIN_USERNAME || 'admin'

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
