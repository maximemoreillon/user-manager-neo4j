import { Request, Response, NextFunction } from "express"
import createHttpError from "http-errors"
import { removeUserFromCache } from "../cache"
import { user_query } from "../utils/users"
import { driver } from "../db"

export const revokeToken = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  const session = driver.session()

  try {
    const current_user = res.locals.user
    const current_user_id = current_user._id
    const user_is_admin = res.locals.user.isAdmin

    let { user_id } = req.params
    if (user_id === "self") user_id = current_user_id

    // Prevent an user from modifying another's password
    if (String(user_id) !== String(current_user_id) && !user_is_admin) {
      throw createHttpError(403, `Unauthorized to modify another user`)
    }

    const query = `
      ${user_query}
      SET user.token_id = randomUUID()
      RETURN user
      `

    const { records } = await session.run(query, {})
    if (!records.length) throw createHttpError(404, `User ${user_id} not found`)

    const { properties: user } = records[0].get("user")
    delete user.password_hashed

    console.log(`[Neo4J] Token of user ${user_id} revoked`)
    removeUserFromCache(user_id)
    res.send(user)
  } catch (error) {
    next(error)
  } finally {
    session.close()
  }
}
