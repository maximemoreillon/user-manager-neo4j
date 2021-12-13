const neo4j = require('neo4j-driver')
const dotenv = require('dotenv')

dotenv.config()

const {
  NEO4J_URL = 'bolt://neo4j:7687',
  NEO4J_USERNAME = 'neo4j',
  NEO4J_PASSWORD = 'neo4j',
} = process.env

const auth = neo4j.auth.basic( NEO4J_USERNAME, NEO4J_PASSWORD )

const options = { disableLosslessIntegers: true }

const driver = neo4j.driver( NEO4J_URL, auth, options )

let connected = false

const init = async () => {
  console.log('[Neo4J] Initializing DB')

  const id_setting_query = `
  MATCH (u:User)
  WHERE NOT EXISTS(u._id)
  SET u._id = toString(id(u))
  RETURN COUNT(u) as count
  `

  const session = driver.session()

  try {
    const {records} = await session.run(id_setting_query)
    const count = records[0].get('count')
    console.log(`[Neo4J] ID of ${count} nodes have been set`)
    connected = true
  }
  catch (e) {
    console.log(e)
    console.log(`[Neo4J] init failed, retrying in 10s`)
    setTimeout(init,10000)
  }
  finally {
    session.close()
  }

}

exports.init = init
exports.get_connected = () => connected
exports.driver = driver
exports.url = NEO4J_URL
