const {Router} = require('express')
const controller = require('../../controllers/v2/users.js')
const {middleware} = require('../../controllers/v2/auth.js')

const router = Router()

router.use(middleware)

router.route('/')
  .post(controller.create_user)
  .get(controller.get_users)

router.route('/:user_id')
  .get(controller.get_user)
  .delete(controller.delete_user)
  .patch(controller.patch_user)

router.route('/:user_id/password')
  .put(controller.update_password)
  .patch(controller.update_password)

module.exports = router
