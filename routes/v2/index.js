const {Router} = require('express')
const auth_router = require('./auth.js')
const users_router = require('./users.js')

const router = Router()

router.use('/auth', auth_router)
router.use('/users', users_router)


module.exports = router
