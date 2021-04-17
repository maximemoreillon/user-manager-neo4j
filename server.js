// modules
const express = require('express')
const bodyParser = require('body-parser')
const cors = require('cors')
const dotenv = require('dotenv')
const pjson = require('./package.json')

const auth_router = require('./routes/auth.js')
const users_router = require('./routes/users.js')
const controller = require('./controllers/users.js')

dotenv.config()

// Port configuration
const APP_PORT = process.env.APP_PORT || 80


// Express configuration
const app = express()
app.use(bodyParser.json())
app.use(cors())

app.get('/', (req, res) => {
  res.send({
    application_name: 'User manager API',
    author: 'Maxime MOREILLON',
    version: pjson.version,
    neo4j_url: process.env.NEO4J_URL || 'UNDEFINED',
    authentication_api_url: process.env.AUTHENTICATION_API_URL || 'UNDEFINED'
  })
})

app.use('/users', users_router)
app.use('/auth', auth_router)

// Start server
app.listen(APP_PORT, () => {
  console.log(`[Express] User manager listening on *:${APP_PORT}`);
})

controller.create_admin_if_not_exists()
