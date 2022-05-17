const neo4j = require('neo4j-driver')
const dotenv = require('dotenv')

const { hash_password } = require('./utils/passwords.js')

dotenv.config()

const {
  NEO4J_URL = 'bolt://neo4j:7687',
  NEO4J_USERNAME = 'neo4j',
  NEO4J_PASSWORD = 'neo4j',
} = process.env

let connected = false
let initialized = false

const auth = neo4j.auth.basic( NEO4J_USERNAME, NEO4J_PASSWORD )

const options = { disableLosslessIntegers: true }

const driver = neo4j.driver( NEO4J_URL, auth, options )


const create_admin_if_not_exists = async () => {

  console.log(`[Neo4J] Creating admin account`)

  const session = driver.session()

  try {
    const {
      DEFAULT_ADMIN_USERNAME: admin_username = 'admin',
      DEFAULT_ADMIN_PASSWORD: admin_password = 'admin',
    } = process.env


    const password_hashed = await hash_password(admin_password)

    const query = `
      // Find the administrator account or create it if it does not exist
      MERGE (administrator:User {username:$admin_username})

      // Check if the administrator account is missing its password
      // If the administrator account does not have a password (newly created), set it
      WITH administrator
      WHERE NOT EXISTS(administrator.password_hashed)
      SET administrator.password_hashed = $password_hashed
      SET administrator._id = randomUUID() // THIS IS IMPORTANT
      SET administrator.isAdmin = true

      // Set some additional properties
      SET administrator.display_name = 'Administrator'

      // Return the account
      RETURN administrator
      `

    const { records } = await session.run(query, { admin_username, password_hashed })

    if (records.length) console.log(`[Neo4J] Admin creation: admin account created`)
    else console.log(`[Neo4J] Admin creation: admin already existed`)



  } catch (error) {
    console.error(`Admin creation failed`)
    throw(error)
  } finally {
    session.close()
  }
}

const set_ids_to_nodes_without_ids = async () => {
  const id_setting_query = `
  MATCH (u:User)
  WHERE NOT EXISTS(u._id)
  SET u._id = toString(id(u))
  RETURN COUNT(u) as count
  `

  const session = driver.session()

  try {
    const { records } = await session.run(id_setting_query)
    const count = records[0].get('count')
    console.log(`[Neo4J] ID of ${count} nodes have been set`)
  }
  catch (error) {
    console.error(`Setting IDs failed`)
    throw error
  }
  finally {
    session.close()
  }
}

const create_db_constraints = async () => {

  const session = driver.session()

  try {
    await session.run(`CREATE CONSTRAINT ON (u:User) ASSERT u._id IS UNIQUE`)
    await session.run(`CREATE CONSTRAINT ON (u:User) ASSERT u.email_address IS UNIQUE`)
    await session.run(`CREATE CONSTRAINT ON (u:User) ASSERT u.username IS UNIQUE`)
    console.log(`[Neo4J] Created constraints`)
  }
  catch (error) {
    console.error(`Creating contraints failed`)
    throw error
  }
  finally {
    session.close()
  }

}

const init = async () => {
  console.log('[Neo4J] Initializing DB')

  try {
    await create_admin_if_not_exists()
    connected = true
    await set_ids_to_nodes_without_ids()
    await create_db_constraints()
    initialized = true
  } 
  catch (error) {
    console.error(`[Neo4J] DB init failed`)
    console.error(error)
    console.error(`[Neo4J] Retrying in 5s...`)
    setTimeout(init, 5000)
  }

}

exports.driver = driver
exports.url = NEO4J_URL
exports.init = init
exports.get_connected = () => connected
exports.get_initialized = () => initialized
