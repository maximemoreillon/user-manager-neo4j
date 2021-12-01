// modules
const express = require('express')
const bodyParser = require('body-parser')
const cors = require('cors')
const dotenv = require('dotenv')
const {version, author} = require('./package.json')

const auth_router = require('./routes/auth.js')
const users_router = require('./routes/users.js')
const controller = require('./controllers/users.js')

dotenv.config()

console.log(`== User manager (Neo4J) v${version} ==`)
// Port configuration
const {
  APP_PORT = 80,
  NEO4J_URL = 'UNDEFINED'
} = process.env

// Express configuration
const app = express()
app.use(bodyParser.json())
app.use(cors())

app.get('/', (req, res) => {
  res.send({
    application_name: 'User manager (Neo4J version)',
    author,
    version,
    neo4j_url: NEO4J_URL,
  })
})

app.use('/users', users_router)
app.use('/auth', auth_router)

// Start server
app.listen(APP_PORT, () => {
  console.log(`[Express] Listening on *:${APP_PORT}`);
})

controller.create_admin_if_not_exists()

exports.app = app
