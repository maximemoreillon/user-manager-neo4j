const bcrypt = require('bcrypt')
const jwt = require('jsonwebtoken')
const {driver} = require('./db.js')

exports.error_handling = (error, res) => {
  const {tag} = error
  const status_code = error.code || 500
  const message = error.message || error
  res.status(status_code).send(message)
  if(tag) console.log(`[${tag}] ${message}`)
  else console.log(`${message}`)

}

const get_id_of_user = (user) => {
  return user._id // future proofing
    ?? user.properties._id // current
    ?? user.identity.low // to be removed
    ?? user.identity // to be removed
}

exports.get_id_of_user = get_id_of_user

exports.get_current_user_id = (res) => {
  const user = res.locals.user
  return get_id_of_user(user)
}

const user_id_filter = ` WHERE user._id = $user_id `
const user_query = ` MATCH (user:User) ${user_id_filter}`
exports.user_id_filter = user_id_filter
exports.user_query = user_query

exports.generate_token = (user) => new Promise( (resolve, reject) => {

  const JWT_SECRET = process.env.JWT_SECRET
  if(!JWT_SECRET) return reject({code: 500, message: `Token secret not set`})

  const user_id = get_id_of_user(user)
  const token_content = { user_id }

  jwt.sign(token_content, JWT_SECRET, (error, token) => {
    if(error) return reject({code: 500, message: error})
    resolve(token)
  })
})

exports.decode_token = (token) => new Promise ( (resolve, reject) => {

  const JWT_SECRET = process.env.JWT_SECRET
  if(!JWT_SECRET) return reject({code: 500, message: `Token secret not set`})

  jwt.verify(token, JWT_SECRET, (error, decoded_token) => {
    if(error) return reject({code: 403, message: `Invalid JWT`})
    resolve(decoded_token)
  })
})

exports.compare_password = (password_plain, password_hashed) => bcrypt.compare(password_plain, password_hashed)
exports.hash_password = (password_plain) => bcrypt.hash(password_plain, 10)


const find_user_by_id = (user_id) => new Promise ( (resolve, reject) => {

  const session = driver.session()

  const query = `${user_query} RETURN user`
  // Could enforce string here
  const params = {user_id}

  session.run(query, params)
  .then(result => {

    if(!result.records.length) return reject({code: 400, message: `User ${user_id} not found`, tag: 'Neo4J'})
    if(result.records.length > 1) return reject({code: 500, message: `Multiple users ${user_id} found`, tag: 'Neo4J'})

    const user = result.records[0].get('user')

    resolve(user)
  })
  .catch(error => { reject({code: 500, message:error}) })
  .finally( () => { session.close() } )

})
exports.find_user_by_id = find_user_by_id


const find_user_in_db = (identifier) => new Promise ( (resolve, reject) => {

  const session = driver.session()
  const query = `
    MATCH (user:User)

    // Allow user to identify using either userrname or email address
    WHERE user.username = $identifier
      OR user.email_address=$identifier
      OR user._id = $identifier

    // Return user if found
    RETURN user
    `

  const params = {identifier}

  session.run(query, params)
  .then(result => {

    if(!result.records.length) return reject({code: 400, message: `User ${identifier} not found`, tag: 'Neo4J'})
    if(result.records.length > 1) return reject({code: 500, message: `Multiple users ${identifier} found`, tag: 'Neo4J'})

    const user = result.records[0].get('user')

    resolve(user)
  })
  .catch(error => { reject({code: 500, message:error}) })
  .finally( () => { session.close() } )

})
exports.find_user_in_db = find_user_in_db
