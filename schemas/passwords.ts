import Joi from "joi"

export const passwordUpdateSchema = Joi.object({
  new_password: Joi.string()
    .min(6)
    .pattern(new RegExp("^[a-zA-Z0-9]{3,30}$"))
    .required(),

  new_password_confirm: Joi.ref("new_password"),
}).with("new_password", "new_password_confirm")
