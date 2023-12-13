import { NextFunction, Request, Response } from "express"

export const refreshAccessToken = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  res.status(501).send("Not implemented")
}
