import Joi from "joi"

export const newUserSchema = Joi.object({
  username: Joi.string().min(3).max(30).required(),

  password: Joi.string()
    .min(6)
    .pattern(new RegExp("^[a-zA-Z0-9]{3,30}$"))
    .required(),

  password_confirm: Joi.ref("password"),

  email_address: Joi.string().email({}).allow(null, ""),
})

const user_update = {
  // Fields that can be edited by regular users
  avatar_src: Joi.string().max(500),

  website: Joi.string().max(500),

  // Naming
  display_name: Joi.string().min(2).max(100),
  last_name: Joi.string().min(2).max(100),
  first_name: Joi.string().min(2).max(100),
}

const user_admin_update = {
  // Fields that can be edited by administrators
  isAdmin: Joi.boolean(),
  locked: Joi.boolean(),
  activated: Joi.boolean(),
}

export const userUpdateSchema = Joi.object(user_update)
export const userAdminUpdateSchema = Joi.object({
  ...user_update,
  ...user_admin_update,
})
