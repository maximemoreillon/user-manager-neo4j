const express = require('express')
const controller = require('../controllers/users.js')
const auth = require('../controllers/auth.js')

const router = express.Router()

router.use(auth.middleware)

router.route('/')
  .post(controller.create_user)
  .get(controller.get_users)

router.route('/:user_id')
  .get(controller.get_user)
  .delete(controller.delete_user)
  .patch(controller.patch_user)

router.route('/:user_id/password')
  .put(controller.update_password)

module.exports = router
