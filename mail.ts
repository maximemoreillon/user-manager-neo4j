import nodemailer from "nodemailer"
import { generate_token } from "./utils/tokens"
import { MailOptions } from "nodemailer/lib/json-transport"
import SMTPTransport from "nodemailer/lib/smtp-transport"

export const {
  SMTP_HOST = "mail.example.com",
  SMTP_PORT = 465,
  SMTP_USERNAME = "username",
  SMTP_PASSWORD = "password",
  SMTP_FROM = "noreply@example.com",
} = process.env

export const options: SMTPTransport.Options = {
  host: SMTP_HOST,
  port: Number(SMTP_PORT),
  secure: true,
  auth: {
    user: SMTP_USERNAME,
    pass: SMTP_PASSWORD,
  },
}

export const transporter = nodemailer.createTransport(options)

const send_email = (email: MailOptions) =>
  new Promise((resolve, reject) => {
    // This might already be a promise
    transporter.sendMail(email, (error: any, info: any) => {
      if (error) reject(error)
      else resolve(info)
    })
  })

export const send_activation_email = async ({ url, user }: any) => {
  try {
    const { email_address } = user
    const token = await generate_token(user)

    const activation_email = {
      from: SMTP_FROM,
      to: email_address,
      subject: "Account activation",
      text: `Click the following link to register your account: ${url}/activate?token=${token}`,
    }

    await send_email(activation_email)

    console.log(`[Mail] Sent activation email to user ${email_address}`)
  } catch (e) {
    throw `Error while sending email: ${e}`
  }
}

export const send_password_reset_email = async ({ url, user }: any) => {
  try {
    const { email_address } = user
    const token = await generate_token(user)

    const email = {
      from: SMTP_FROM,
      to: email_address,
      subject: "Password reset",
      text: `Click the following link to reset your password: ${url}/password_update?token=${token}`,
    }

    await send_email(email)

    console.log(`[Mail] Sent password reset email to user ${email_address}`)
  } catch (e) {
    throw `Error while sending email: ${e}`
  }
}
