import { Router } from "express"
import { middleware } from "../controllers/auth"
import { revokeToken } from "../controllers/tokens"

const router = Router({ mergeParams: true })

router
  .route("/token")
  .put(middleware, revokeToken)
  .delete(middleware, revokeToken)

export default router
