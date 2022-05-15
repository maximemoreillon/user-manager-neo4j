const express = require('express')
const { login } = require('../../controllers/v2/auth.js')
const { request_password_reset } = require('../../controllers/v3/password.js')

const router = express.Router()

router.route('/login')
  .post(login)

router.route('/password/reset')
  .post(request_password_reset)

module.exports = router
