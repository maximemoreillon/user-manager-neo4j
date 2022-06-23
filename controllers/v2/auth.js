const dotenv = require('dotenv')
const createHttpError = require('http-errors')
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

    const query = `${user_query} RETURN properties(user) as user`

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

    if(!identifier) throw createHttpError(400, `Missing username or e-mail address`)
    if(!password) throw createHttpError(400, `Missing password`)

    console.log(`[Auth] Login attempt from user identified as ${identifier}`)

    // User query
    const {properties: user} = await find_user_in_db(identifier)

    // Activated check
    if (!user.activated && !user.isAdmin) throw createHttpError(403, `This user is not activated`)

    // Lock check
    if(user.locked) throw createHttpError(403, `This account is locked`)

    // Password check
    const password_correct = await compare_password(password, user.password_hashed)
    if(!password_correct) throw createHttpError(403, `Incorrect password`)

    await register_last_login(user._id)

    const jwt = await generate_token(user)

    res.send({jwt, user})

    console.log(`[Auth] Successful login from user identified as ${identifier}`)
  }
  catch (error) {
    next(error)
  }

}
