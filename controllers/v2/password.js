const createHttpError = require('http-errors')
const { passwordUpdateSchema } = require('../../schemas/passwords.js')
const { driver } = require('../../db.js')
const {
    hash_password,
    user_query,
} = require('../../utils.js')


exports.update_password = async (req, res, next) => {

    const session = driver.session()

    try {


        try {
            await passwordUpdateSchema.validateAsync(req.body)
        }
        catch (error) {
            throw createHttpError(400, error.message)
        }

        const { new_password } = req.body

        // Get current user info
        let { user_id } = req.params
        const current_user_id = res.locals.user._id
        if (user_id === 'self') user_id = current_user_id
        const user_is_admin = res.locals.user.isAdmin

        // Prevent an user from modifying another's password
        if (String(user_id) !== String(current_user_id) && !user_is_admin) {
            throw createHttpError(403, `Unauthorized to modify another user's password`)
        }


        const password_hashed = await hash_password(new_password)

        const query = `
            ${user_query}
            SET user.password_hashed = $password_hashed
            SET user.password_changed = true
            RETURN user
            `

        const params = { user_id, password_hashed }

        const { records } = await session.run(query, params)

        if (!records.length) throw createHttpError(404, `User ${user_id} not found`)

        const { properties: user } = records[0].get('user')
        delete user.password_hashed
        console.log(`[Neo4J] Password of user ${user_id} updated`)
        res.send(user)

    }
    catch (error) {
        next(error)
    }
    finally {
        session.close()
    }

}

exports.request_password_reset = async (req, res, next) => {

    const session = driver.session()

    const {
        PASSWORD_RESET_URL: url = req.headers.origin
    } = process.env

    try {
        const { email_address } = req.body
        if (!email_address) throw createHttpError(400, `Missing email address`)

        const query = `
            MATCH (user:User)
            WHERE user.email_address = $email_address
            RETURN properties(user) as user
            `

        const { records } = await session.run(query, { email_address })
        if (!records.length) throw createHttpError(400, `User not found`)

        const user = records[0].get('user')

        const mail_options = { url, user }
        await send_password_reset_email(mail_options)

        res.send({ email_address })
    }
    catch (error) {
        next(error)
    }
    finally {
        session.close()
    }


}