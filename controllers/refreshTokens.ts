import { NextFunction, Request, Response } from "express"
import { decode_token, generate_token } from "../utils/tokens"
import { driver } from "../db"
import { user_query } from "../utils/users"

export const refreshAccessToken = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  res.status(501).send("Not implemented")
}
