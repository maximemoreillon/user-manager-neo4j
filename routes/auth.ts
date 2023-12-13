import express from "express"
import { login } from "../controllers/auth"
import { request_password_reset } from "../controllers/password"
import { refreshAccessToken } from "../controllers/refreshTokens"
import { decodeAccessToken } from "../controllers/accessTokens"

const router = express.Router()

router.route("/login").post(login)
router.route("/token").post(decodeAccessToken)
router.route("/access-token").post(decodeAccessToken)
router.route("/refresh-token").post(refreshAccessToken)
router.route("/password/reset").post(request_password_reset)

export default router
