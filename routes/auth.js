const express = require("express")
const { login } = require("../controllers/auth.js")
const { request_password_reset } = require("../controllers/password.js")

const router = express.Router()

router.route("/login").post(login)

router.route("/password/reset").post(request_password_reset)

module.exports = router
