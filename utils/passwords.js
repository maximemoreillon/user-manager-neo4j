const bcrypt = require('bcrypt')

exports.compare_password = (password_plain, password_hashed) => bcrypt.compare(password_plain, password_hashed)
exports.hash_password = (password_plain) => bcrypt.hash(password_plain, 10)
