const Cookies = require('cookies')
const dotenv = requiree('dotenv')
const jwt = require('jsonwebtoken')
const { get_id_of_user } = require('./users.js')

dotenv.config()

const { JWT_SECRET } = process.env

if (!JWT_SECRET) throw new Error(`Token secret not set`)

exports.retrieve_jwt = (req, res) => new Promise((resolve, reject) => {

    // Did not need to be a promise

    const jwt = req.headers.authorization?.split(" ")[1]
        || req.headers.authorization
        || (new Cookies(req, res)).get('jwt')
        || (new Cookies(req, res)).get('token')
        || req.query.jwt
        || req.query.token

    if (!jwt) return reject(`JWT not provided`)

    resolve(jwt)
})

exports.generate_token = (user) => new Promise((resolve, reject) => {

    const user_id = get_id_of_user(user).toString() // forcing string
    const token_content = { user_id }

    jwt.sign(token_content, JWT_SECRET, (error, token) => {
        if (error) return reject({ code: 500, message: error })
        resolve(token)
    })
})

exports.decode_token = (token) => new Promise((resolve, reject) => {

    jwt.verify(token, JWT_SECRET, (error, decoded_token) => {
        if (error) return reject(createHttpError(403, `Invalid JWT`))
        resolve(decoded_token)
    })
})