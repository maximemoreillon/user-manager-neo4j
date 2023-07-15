import { Response } from "express"
import createHttpError from "http-errors"
import { driver } from "../db"

export const register_last_login = async (user_id: string) => {
  const session = driver.session()

  try {
    const query = `
      ${user_query}
      SET user.last_login = date()
      RETURN user.last_login as last_login
      `

    await session.run(query, { user_id })
    console.log(`[Auth] Successfully registered last login for user ${user_id}`)
  } catch (error) {
    throw error
  } finally {
    session.close()
  }
}

export const get_id_of_user = (user: any) => {
  return (
    user._id ?? // future proofing
    user.properties._id ?? // current
    user.identity.low ?? // to be removed
    user.identity
  ) // to be removed
}

export const get_current_user_id = (res: Response) => {
  const user = res.locals.user
  return get_id_of_user(user)
}

export const user_id_filter = ` WHERE user._id = $user_id `
export const user_query = ` MATCH (user:User) ${user_id_filter}`

export const find_user_in_db = (identifier: string) =>
  new Promise((resolve, reject) => {
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

    const params = { identifier }

    session
      .run(query, params)
      .then((result) => {
        if (!result.records.length)
          return reject(createHttpError(404, `User ${identifier} not found`))
        if (result.records.length > 1)
          return reject(
            createHttpError(500, `Multiple users ${identifier} found`)
          )

        const user = result.records[0].get("user")

        resolve(user)
      })
      .catch((error) => {
        reject({ code: 500, message: error })
      })
      .finally(() => {
        session.close()
      })
  })
