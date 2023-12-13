import dotenv from "dotenv"
import createHttpError from "http-errors"
import { driver } from "../db"
import { compare_password } from "../utils/passwords"
import { decode_token, generate_token, retrieve_jwt } from "../utils/tokens"
import { Response, Request, NextFunction } from "express"
import { getUserFromCache, setUserInCache, removeUserFromCache } from "../cache"
import {
  user_query,
  find_user_in_db,
  register_last_login,
} from "../utils/users"

dotenv.config()

export const { JWT_EXPIRATION_TIME = "infinite" } = process.env

export const middleware = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const token = await retrieve_jwt(req, res)
    const decodedToken = (await decode_token(token as string)) as any
    const { user_id, token_id: tokenIdFromToken, iat } = decodedToken

    if (!user_id) throw `Token does not contain user_id`

    let user: any = await getUserFromCache(user_id)

    if (!user) {
      const session = driver.session()
      try {
        const query = `${user_query} RETURN properties(user) as user`
        const { records } = await session.run(query, { user_id })

        if (!records.length) throw `User ${user_id} not found in the database`
        if (records.length > 1)
          throw `Multiple users with ID ${user_id} found in the database`

        user = records[0].get("user")

        setUserInCache(user)
        user.cached = false
      } catch (error) {
        throw error
      } finally {
        session.close()
      }
    }

    if (!user) throw "User does not exist"

    // Token checks
    if (tokenIdFromToken !== user.token_id) throw `Token has been revoked`
    if (JWT_EXPIRATION_TIME && JWT_EXPIRATION_TIME !== "infinite") {
      const now = new Date().getTime() / 1000
      if (now - iat > Number(JWT_EXPIRATION_TIME)) throw `Token has expired`
    }

    res.locals.user = user
    next()
  } catch (error) {
    console.log(error)
    res.status(403).send(error)
  }
}

export const login = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    // Input management
    const identifier =
      req.body.username ||
      req.body.email_address ||
      req.body.email ||
      req.body.identifier

    const { password } = req.body

    if (!identifier)
      throw createHttpError(400, `Missing username or e-mail address`)
    if (!password) throw createHttpError(400, `Missing password`)

    console.log(`[Auth] Login attempt from user identified as ${identifier}`)

    // User query
    const { properties: user } = (await find_user_in_db(identifier)) as any

    const { activated, isAdmin, locked } = user

    // Activated check
    if (!activated && !isAdmin)
      throw createHttpError(403, `This user is not activated`)

    // Lock check
    if (locked) throw createHttpError(403, `This account is locked`)

    // Password check
    const password_correct = await compare_password(
      password,
      user.password_hashed
    )
    if (!password_correct) throw createHttpError(403, `Incorrect password`)

    register_last_login(user._id)
    removeUserFromCache(user._id)

    const jwt = await generate_token(user)
    // TODO: refresh token

    console.log(`[Auth] Successful login from user identified as ${identifier}`)

    res.send({ jwt, user })
  } catch (error) {
    next(error)
  }
}
