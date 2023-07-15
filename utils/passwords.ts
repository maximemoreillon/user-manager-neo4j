import bcrypt from "bcrypt"

export const compare_password = (
  password_plain: string,
  password_hashed: string
) => bcrypt.compare(password_plain, password_hashed)

export const hash_password = (password_plain: string) =>
  bcrypt.hash(password_plain, 10)
