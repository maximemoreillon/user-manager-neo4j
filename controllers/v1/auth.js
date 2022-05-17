const dotenv = require('dotenv')
const { driver } = require('../../db.js')
const { compare_password } = require('../../utils/passwords.js')
const {
  decode_token,
  generate_token,
  retrieve_jwt,
} = require('../../utils/tokens.js')
const {
  user_query,
  find_user_in_db,
  register_last_login,
} = require('../../utils/users.js')

dotenv.config()


exports.middleware = async (req, res, next) => {

  const session = driver.session()

  try {
    const token = await retrieve_jwt(req, res)
    const {user_id} = await decode_token(token)

    const query = `${user_query} RETURN user`
    const {records} = await session.run(query, {user_id})

    if(!records.length) throw `User ${user_id} not found in the database`
    if(records.length > 1) throw `Multiple users with ID ${user_id} found in the database`

    const user = records[0].get('user')

    res.locals.user = user

    next()
  }
  catch (error) {
    console.log(error)
    res.status(403).send(error)
  }
  finally {
    session.close()
  }

}

exports.login = async (req, res, next) => {

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
    const user = await find_user_in_db(identifier)

    // Lock check
    if(user.properties.locked) throw {code: 403, message: `This account is locked`}

    // Password check
    const password_correct = await compare_password(password, user.properties.password_hashed)
    if(!password_correct) throw {code: 403, message: `Incorrect password`}

    await register_last_login(user.properties._id)

    const jwt = await generate_token(user)

    res.send({jwt})

    console.log(`[Auth] Successful login from user identified as ${identifier}`)
  }
  catch (error) {
    next(error)
  }

}
