import { Router } from "express"
import auth_router from "./auth"
import users_router from "./users"
import { commit } from "../commit.json"
import { options as smtp_options } from "../mail"
import { version, author } from "../package.json"
import { url as neo4j_url, get_connected } from "../db"

const router = Router()

router.get("/", (req, res) => {
  res.send({
    application_name: "User manager (Neo4J version)",
    author,
    version,
    commit,
    neo4j: {
      url: neo4j_url,
      connected: get_connected(),
    },
    smtp: {
      host: smtp_options.host,
      port: smtp_options.port,
    },
  })
})

router.use("/auth", auth_router)
router.use("/users", users_router)

export default router
