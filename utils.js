const bcrypt = require('bcrypt')

exports.error_handling = (error, res) => {
  const {tag} = error
  const status_code = error.code || 500
  const message = error.message || error
  res.status(status_code).send(message)
  if(tag) console.log(`[${tag}] ${message}`)
  else console.log(`${message}`)

}

// Auth related
exports.compare_password = (password_plain, password_hashed) => bcrypt.compare(password_plain, password_hashed)
exports.hash_password = (password_plain) => bcrypt.hash(password_plain, 10)
