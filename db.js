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
const connection_check = async () => {
  try {
    console.log(`[Neo4J] Connection check...`)
    const session = driver.session()
    await session.run(` RETURN 'OK' `)
    console.log(`[Neo4J] connected`)
    connected = true
  }
  catch (e) {
    console.log(`[Neo4J] connection error`)
  }
}

exports.connection_check = connection_check
exports.get_connected = () => connected
exports.driver = driver
exports.url = NEO4J_URL
