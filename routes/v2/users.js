const { Router } = require('express')
const { middleware } = require('../../controllers/v2/auth.js')
const password_router = require('./password')
const {
  create_user,
  read_users,
  read_user,
  update_user,
  delete_user,
} = require('../../controllers/v2/users.js')

const router = Router()

router.use(middleware)

router.route('/')
  .post(create_user)
  .get(read_users)

router.route('/:user_id')
  .get(read_user)
  .delete(delete_user)
  .patch(update_user)

router.use('/:user_id/password', password_router)

module.exports = router
