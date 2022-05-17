const createHttpError = require('http-errors')
const { driver } = require('../db.js')


exports.register_last_login = async (user_id) => {

  const session = driver.session()

  try {
    const query = `
      ${user_query}
      SET user.last_login = date()
      RETURN user.last_login as last_login
      `

    await session.run(query, {user_id})
    console.log(`[Auth] Successfully registered last login for user ${user_id}`)
  }
  catch (error) {
    throw error
  }
  finally {
    session.close()
  }
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

const find_user_in_db = (identifier) => new Promise ( (resolve, reject) => {

  const session = driver.session()
  const query = `
    MATCH (user:User)

    // Allow user to identify using either userrname or email address
    WHERE user.username = $identifier
      OR user.email_address = $identifier
      OR user._id = $identifier

    // Return user if found
    RETURN user
    `

  const params = {identifier}

  session.run(query, params)
  .then(result => {

    if(!result.records.length) return reject(createHttpError(404, `User ${identifier} not found`))
    if(result.records.length > 1) return reject(createHttpError(500, `Multiple users ${identifier} found`))

    const user = result.records[0].get('user')

    resolve(user)
  })
  .catch(error => { reject({code: 500, message:error}) })
  .finally( () => { session.close() } )

})
exports.find_user_in_db = find_user_in_db

