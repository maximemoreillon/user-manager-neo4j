import dotenv from "dotenv"
dotenv.config()
import express from "express"
import cors from "cors"
import apiMetrics from "prometheus-api-metrics"
import { version } from "./package.json"
import { init as db_init } from "./db"
import { init as cache_init } from "./cache"
import router from "./routes"
import errorHandler from "./utils/errorHandler"
console.log(`== User manager (Neo4J version) v${version} ==`)

db_init()
cache_init()

const { APP_PORT = 80 } = process.env

export const app = express()

app.use(express.json())
app.use(cors())
app.use(apiMetrics())
app.use("/", router)
app.use(errorHandler)

app.listen(APP_PORT, () => {
  console.log(`[Express] Listening on *:${APP_PORT}`)
})
