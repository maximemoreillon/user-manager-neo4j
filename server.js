// modules
const express = require('express')
const bodyParser = require('body-parser')
const cors = require('cors')
const dotenv = require('dotenv')
const {version, author} = require('./package.json')
const router_v1 = require('./routes/v1/index.js')
const controller = require('./controllers/v1/users.js')
const {commit} = require('./commit.json')
const {
  url: neo4j_url,
  get_connected,
  connection_check: db_connection_check
} = require('./db.js')

dotenv.config()

console.log(`== User manager (Neo4J edition) v${version} ==`)


db_connection_check()

// Port configuration
const {
  APP_PORT = 80,
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
    commit,
    neo4j: {
      url: neo4j_url,
      connected: get_connected(),
    },
  })
})

app.use('/', router_v1)
app.use('/v1', router_v1)

// Start server
app.listen(APP_PORT, () => {
  console.log(`[Express] Listening on *:${APP_PORT}`);
})

controller.create_admin_if_not_exists()

exports.app = app
