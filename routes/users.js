const express = require('express')
const controller = require('../controllers/users.js')
const auth = require('@moreillon/authentication_middleware')

const router = express.Router()

router.use(auth.authenticate)

router.route('/')
  .post(controller.create_user)
  .get(controller.get_all_users)

router.route('/:user_id')
  .get(controller.get_user)
  .delete(controller.delete_user)
  .patch(controller.patch_user)

router.route('/:user_id/password')
  .put(controller.update_password)

module.exports = router
