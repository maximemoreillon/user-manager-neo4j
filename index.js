// modules
const express = require('express')
const bodyParser = require('body-parser')
const cors = require('cors')
const dotenv = require('dotenv')
const apiMetrics = require('prometheus-api-metrics')
const { version } = require('./package.json')
const { init: db_init } = require('./db.js')

dotenv.config()

console.log(`== User manager (Neo4J version) v${version} ==`)


db_init()

// Port configuration
const {
  APP_PORT = 80,
} = process.env

// Express configuration
const app = express()

app.use(bodyParser.json())
app.use(cors())
app.use(apiMetrics())

app.use('/', require('./routes/v1/index.js'))
app.use('/v1', require('./routes/v1/index.js'))
app.use('/v2', require('./routes/v2/index.js'))

// Express error handler
app.use((error, req, res, next) => {
  console.error(error)
  let { statusCode = 500, message = error } = error
  if(isNaN(statusCode) || statusCode > 600) statusCode = 500
  res.status(statusCode).send(message)
})

app.listen(APP_PORT, () => {
  console.log(`[Express] Listening on *:${APP_PORT}`)
})


exports.app = app