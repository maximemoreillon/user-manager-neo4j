import { Router } from "express"
import { middleware } from "../controllers/auth"
import {
  update_password,
  request_password_reset,
} from "../controllers/password"

const router = Router({ mergeParams: true })

router
  .route("/")
  .patch(middleware, update_password)
  .put(middleware, update_password)

router.route("/reset").post(request_password_reset)

export default router
