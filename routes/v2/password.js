
const { Router } = require('express')
const { update_password } = require('../../controllers/v3/password.js')

const router = Router({ mergeParams: true })

router.route('/')
    .patch(update_password)
    .put(update_password)

module.exports = router
