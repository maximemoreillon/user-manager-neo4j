
const { Router } = require('express')
const { middleware } = require('../../controllers/v2/auth.js')
const { 
    update_password, 
    request_password_reset 
} = require('../../controllers/v2/password.js')

const router = Router({ mergeParams: true })

router.route('/')
    .patch(middleware, update_password)
    .put(middleware, update_password)

router.route('/reset')
    .post(request_password_reset)

module.exports = router
