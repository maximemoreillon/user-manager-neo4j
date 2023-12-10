import Cookies from "cookies"
import dotenv from "dotenv"
import jwt from "jsonwebtoken"
import createHttpError from "http-errors"
import { get_id_of_user } from "./users"
import { Request, Response } from "express"

dotenv.config()

const { JWT_SECRET } = process.env

if (!JWT_SECRET) throw new Error(`Token secret not set`)

export const retrieve_jwt = (req: Request, res: Response) =>
  new Promise((resolve, reject) => {
    // Did not need to be a promise

    const jwt =
      req.headers.authorization?.split(" ")[1] ||
      req.headers.authorization ||
      new Cookies(req, res).get("jwt") ||
      new Cookies(req, res).get("token") ||
      req.query.jwt ||
      req.query.token

    if (!jwt) return reject(`JWT not provided`)

    resolve(jwt)
  })

export const generate_token = (user: any) =>
  new Promise((resolve, reject) => {
    const user_id = get_id_of_user(user).toString() // forcing string
    const { token_id } = user
    const token_content = { user_id, token_id }

    jwt.sign(token_content, JWT_SECRET, (error, token) => {
      if (error) return reject({ code: 500, message: error })
      resolve(token)
    })
  })

export const decode_token = (token: string) =>
  new Promise((resolve, reject) => {
    jwt.verify(token, JWT_SECRET, (error, decoded_token) => {
      if (error) return reject(createHttpError(403, `Invalid JWT`))
      resolve(decoded_token)
    })
  })
