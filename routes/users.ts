import password_router from "./password"
import { Router } from "express"
import { middleware } from "../controllers/auth"
import {
  create_user,
  read_users,
  read_user,
  update_user,
  delete_user,
} from "../controllers/users"
import { revokeToken } from "../controllers/accessTokens"

const router = Router()

router.route("/").post(middleware, create_user).get(middleware, read_users)

router
  .route("/:user_id")
  .get(middleware, read_user)
  .delete(middleware, delete_user)
  .patch(middleware, update_user)

router
  .route("/:user_id/token")
  .put(middleware, revokeToken)
  .delete(middleware, revokeToken)

router.use("/:user_id/password", password_router)

export default router
