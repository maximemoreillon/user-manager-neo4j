const express = require('express')
const controller = require('../controllers/auth.js')

const router = express.Router()

router.route('/login')
  .post(controller.login)

module.exports = router
