const nodemailer = require('nodemailer')
const dotenv = require('dotenv')
const { generate_token } = require('./utils/tokens.js')

dotenv.config()

// parsing environment
const {
    SMTP_HOST,
    SMTP_PORT,
    SMTP_USERNAME,
    SMTP_PASSWORD,
    SMTP_FROM
} = process.env


const options = {
    host: SMTP_HOST,
    port: SMTP_PORT,
    secure: true, // upgrade later with STARTTLS
    auth: {
        user: SMTP_USERNAME,
        pass: SMTP_PASSWORD,
    },
}


const transporter = nodemailer.createTransport(options)


const send_email = (email) => new Promise((resolve, reject) => {
    // This might already be a promise
    transporter.sendMail(email, (error, info) => {
        if (error) reject(error)
        else resolve(info)
    })
})

exports.trasnporter = transporter
exports.options = options

exports.send_activation_email = async ({ url, user }) => {

    try {
        const { email_address } = user
        const token = await generate_token(user)

        const activation_email = {
            from: SMTP_FROM,
            to: email_address,
            subject: 'Account activation',
            text: `Click the following link to register your account: ${url}/activate?token=${token}`
        }

        await send_email(activation_email)

        console.log(`[Mail] Sent activation email to user ${email_address}`)
    } catch (e) {
        throw `Error while sending email: ${e}`
    }

}

exports.send_password_reset_email = async ({ url, user }) => {

    try {
        const { email_address } = user
        const token = await generate_token(user)

        const email = {
            from: SMTP_FROM,
            to: email_address,
            subject: 'Password reset',
            text: `Click the following link to reset your password: ${url}/password_update?token=${token}`
        }

        await send_email(email)

        console.log(`[Mail] Sent password reset email to user ${email_address}`)
    } 
    catch (e) {
        throw `Error while sending email: ${e}`
    }

}

exports.smtp = {
    host: options.host,
    port: options.port,
    from: SMTP_FROM,
}
