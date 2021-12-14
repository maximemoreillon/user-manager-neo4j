const {driver} = require('../../db.js')
const dotenv = require('dotenv')
const {
  decode_token,
  generate_token,
  error_handling,
  get_id_of_user,
  compare_password,
  user_query,
  find_user_in_db,
  find_user_by_id,
} = require('../../utils.js')

dotenv.config()


const register_last_login = async (user_id) => {

  const session = driver.session()

  try {
    const query = `
      ${user_query}
      SET user.last_login = date()
      RETURN user
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


const retrieve_jwt = (req, res) => new Promise( (resolve, reject) => {

  // Did not have to be a promise

  const jwt = req.headers.authorization?.split(" ")[1]
    || req.headers.authorization
    || (new Cookies(req, res)).get('jwt')
    || (new Cookies(req, res)).get('token')
    || req.query.jwt
    || req.query.token

  if(!jwt) return reject(`JWT not provided`)

  resolve(jwt)
})


exports.middleware = async (req, res, next) => {

  try {
    const token = await retrieve_jwt(req, res)
    const {user_id} = await decode_token(token)

    const {properties: user} = await find_user_by_id(user_id)

    res.locals.user = user

    next()
  }
  catch (error) {
    console.log(error)
    res.status(403).send(error)
  }

}

exports.login = async (req, res) => {

  try {

    // Input management
    const identifier = req.body.username
      || req.body.email_address
      || req.body.email
      || req.body.identifier

    const {password} = req.body

    if(!identifier) throw {code: 400, message: `Missing username or e-mail address`}
    if(!password) throw {code: 400, message: `Missing password`}

    console.log(`[Auth] Login attempt from user identified as ${identifier}`)

    // User query
    const user_node = await find_user_in_db(identifier)
    const user = user_node.properties // new in V2

    // Lock check
    if(user.locked) throw {code: 403, message: `This account is locked`}

    // Password check
    const password_correct = await compare_password(password, user.password_hashed)
    if(!password_correct) throw {code: 403, message: `Incorrect password`}

    await register_last_login(user._id)

    const jwt = await generate_token(user)

    res.send({jwt})

    console.log(`[Auth] Successful login from user identified as ${identifier}`)
  }
  catch (error) {
    error_handling(error, res)
  }

}
