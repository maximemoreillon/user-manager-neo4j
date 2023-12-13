import { Router } from "express"
import auth_router from "./auth"
import users_router from "./users"
import { SMTP_HOST, SMTP_PORT, SMTP_FROM } from "../mail"
import { version, author } from "../package.json"
import { url as neo4j_url, get_connected } from "../db"
import { REDIS_URL } from "../cache"
import { JWT_EXPIRATION_TIME } from "../controllers/auth"

const router = Router()

router.get("/", (req, res) => {
  res.send({
    application_name: "User manager (Neo4J version)",
    author,
    version,
    neo4j: {
      url: neo4j_url,
      connected: get_connected(),
    },
    smtp: {
      host: SMTP_HOST,
      port: SMTP_PORT,
      from: SMTP_FROM,
    },
    redis: {
      url: REDIS_URL,
    },
    jwt_expiration_time: JWT_EXPIRATION_TIME,
  })
})

router.use("/auth", auth_router)
router.use("/users", users_router)

export default router
