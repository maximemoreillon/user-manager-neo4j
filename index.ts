import express, { NextFunction, Request, Response } from "express"
import cors from "cors"
import dotenv from "dotenv"
import apiMetrics from "prometheus-api-metrics"
import { version } from "./package.json"
import { init as db_init } from "./db"
import router from "./routes"

dotenv.config()

console.log(`== User manager (Neo4J version) v${version} ==`)

db_init()

const { APP_PORT = 80 } = process.env

export const app = express()

app.use(express.json())
app.use(cors())
app.use(apiMetrics())

app.use("/", router)

app.use((error: any, req: Request, res: Response, next: NextFunction) => {
  console.error(error)
  let { statusCode = 500, message = error } = error
  if (isNaN(statusCode) || statusCode > 600) statusCode = 500
  res.status(statusCode).send(message)
})

app.listen(APP_PORT, () => {
  console.log(`[Express] Listening on *:${APP_PORT}`)
})
