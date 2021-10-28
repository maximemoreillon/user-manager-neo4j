const bcrypt = require('bcrypt')

exports.error_handling = (error, res) => {
  const {tag} = error
  const status_code = error.code || 500
  const message = error.message || error
  res.status(status_code).send(message)
  if(tag) console.log(`[${tag}] ${message}`)
  else console.log(`${message}`)

}

exports.compare_password = (password_plain, password_hashed) => new Promise( (resolve, reject) => {
  bcrypt.compare(password_plain, password_hashed, (error, result) => {
    if(error) return reject(error)
    resolve(result)
  })
})

// Those are auth functions
exports.hash_password = (password_plain) => {
  return new Promise ( (resolve, reject) => {
    bcrypt.hash(password_plain, 10, (error, password_hashed) => {
      if(error) return reject({code: 500, message: error})
      resolve(password_hashed)
      //console.log(`[Bcrypt] Password hashed`)
    })
  })
}
