const express = require('express')
const controller = require('../../controllers/v1/auth.js')

const router = express.Router()

router.route('/login')
  .post(controller.login)

module.exports = router
