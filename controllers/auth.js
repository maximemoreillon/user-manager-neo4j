const driver = require('../neo4j_driver.js')
const jwt = require('jsonwebtoken')
const dotenv = require('dotenv')

const {
  error_handling,
  compare_password,
} = require('../utils.js')

const {find_user_in_db} = require('./users.js')

dotenv.config()


const register_last_login = async (user_id) => {

  // This did not need to be async await

  const session = driver.session()

  try {
    const query = `
      MATCH (user:User)
      WHERE id(user) = toInteger($user_id)

      SET user.last_login = date()

      // Return user if found
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






const generate_token = (user) => new Promise( (resolve, reject) => {

  const JWT_SECRET = process.env.JWT_SECRET

  // Check if the secret is set
  if(!JWT_SECRET) return reject({code: 500, message: `Token secret not set`})

  const token_content = { user_id: user.identity }

  jwt.sign(token_content, JWT_SECRET, (error, token) => {

    // handle signing errors
    if(error) return reject({code: 500, message: error})

    // Resolve with token
    resolve(token)

    console.log(`[Auth] Token generated for user ${user.identity}`)

  })
})

const decode_token = (token) => new Promise ( (resolve, reject) => {

  const JWT_SECRET = process.env.JWT_SECRET

  // Check if the secret is set
  if(!JWT_SECRET) return reject({code: 500, message: `Token secret not set`})

  jwt.verify(token, JWT_SECRET, (error, decoded_token) => {

    if(error) return reject({code: 403, message: `Invalid JWT`})

    resolve(decoded_token)

    //console.log(`[Auth] Token decoded successfully`)

  })
})

const retrieve_token_from_headers = (req) => {
  return new Promise ( (resolve, reject) => {

    // Check if authorization header set
    if(!req.headers.authorization) return reject({code: 400, message: `Authorization header not set`})
    // parse the headers to get the token
    const token = req.headers.authorization.split(" ")[1];
    if(!token) return reject({code: 400, message: `Token not found in authorization header`})

    resolve(token)

    //console.log(`[Auth] Token retrieved from headers`)

  })
}

exports.middleware = async (req, res, next) => {

  try {
    const token = await retrieve_token_from_headers(req, res)
    const {user_id} = await decode_token(token)
    const user = await find_user_in_db(user_id)
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

    const password = req.body.password

    if(!identifier) throw {code: 400, message: `Missing username or e-mail address`}
    if(!password) throw {code: 400, message: `Missing password`}

    console.log(`[Auth] Login attempt from user identified as ${identifier}`)

    // User query
    const user = await find_user_in_db(identifier)

    // Lock check
    if(user.properties.locked) throw {code: 403, message: `This account is locked`}

    // Password check
    const password_correct = await compare_password(password, user.properties.password_hashed)
    if(!password_correct) throw {code: 403, message: `Incorrect password`}

    await register_last_login(user.identity)

    const jwt = await generate_token(user)

    res.send({jwt})

    console.log(`[Auth] Successful login from user identified as ${identifier}`)
  }
  catch (error) {
    error_handling(error, res)
  }

}
