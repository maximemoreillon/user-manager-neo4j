const password_router = require("./password.js")
const { Router } = require("express")
const { middleware } = require("../controllers/auth.js")
const {
  create_user,
  read_users,
  read_user,
  update_user,
  delete_user,
} = require("../controllers/users.js")

const router = Router()

router.route("/").post(middleware, create_user).get(middleware, read_users)

router
  .route("/:user_id")
  .get(middleware, read_user)
  .delete(middleware, delete_user)
  .patch(middleware, update_user)

router.use("/:user_id/password", password_router)

module.exports = router
