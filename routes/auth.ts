import express from "express"
import { login } from "../controllers/auth"
import { request_password_reset } from "../controllers/password"

const router = express.Router()

router.route("/login").post(login)

router.route("/password/reset").post(request_password_reset)

export default router
