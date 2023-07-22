import neo4j from "neo4j-driver"
import dotenv from "dotenv"
import { hash_password } from "./utils/passwords"

dotenv.config()

const {
  NEO4J_URL = "bolt://neo4j:7687",
  NEO4J_USERNAME = "neo4j",
  NEO4J_PASSWORD = "neo4j",
  DEFAULT_ADMIN_USERNAME: admin_username = "admin",
  DEFAULT_ADMIN_PASSWORD: admin_password = "admin",
} = process.env

let connected = false

const auth = neo4j.auth.basic(NEO4J_USERNAME, NEO4J_PASSWORD)

const options = { disableLosslessIntegers: true }

export const driver = neo4j.driver(NEO4J_URL, auth, options)

const get_connection_status = async () => {
  const session = driver.session()
  try {
    console.log(`[Neo4J] Testing connection...`)
    await session.run("RETURN 1")
    console.log(`[Neo4J] Connection successful`)
    return true
  } catch (e) {
    console.log(`[Neo4J] Connection failed`)
    console.log(e)
    return false
  } finally {
    session.close()
  }
}

const create_admin_if_not_exists = async () => {
  console.log(`[Neo4J] Creating admin account`)

  const session = driver.session()

  try {
    const password_hashed = await hash_password(admin_password)

    const query = `
      // Find the administrator account or create it if it does not exist
      MERGE (administrator:User {username:$admin_username})

      // Check if the administrator account is missing its password
      // If the administrator account does not have a password (newly created), set it
      WITH administrator
      WHERE administrator.password_hashed IS NULL
      SET administrator.password_hashed = $password_hashed
      SET administrator._id = randomUUID() // THIS IS IMPORTANT
      SET administrator.isAdmin = true
      SET administrator.display_name = 'Administrator'
      SET administrator.activated = true

      // Return the account
      RETURN administrator
      `

    const { records } = await session.run(query, {
      admin_username,
      password_hashed,
    })

    if (records.length)
      console.log(`[Neo4J] Admin creation: admin account created`)
    else console.log(`[Neo4J] Admin creation: admin already existed`)
  } catch (error) {
    console.error(`Admin creation failed`)
    throw error
  } finally {
    session.close()
  }
}

const set_ids_to_nodes_without_ids = async () => {
  const id_setting_query = `
  MATCH (u:User)
  WHERE u._id IS NULL
  SET u._id = toString(id(u))
  RETURN COUNT(u) as count
  `

  const session = driver.session()

  try {
    const { records } = await session.run(id_setting_query)
    const count = records[0].get("count")
    console.log(`[Neo4J] ID of ${count} nodes have been set`)
  } catch (error) {
    console.error(`Setting IDs failed`)
    throw error
  } finally {
    session.close()
  }
}

const create_constraints = async () => {
  const session = driver.session()

  try {
    await session.run(`CREATE CONSTRAINT FOR (u:User) REQUIRE u._id IS UNIQUE`)
    await session.run(
      `CREATE CONSTRAINT FOR (u:User) REQUIRE u.email_address IS UNIQUE`
    )
    await session.run(
      `CREATE CONSTRAINT FOR (u:User) REQUIRE u.username IS UNIQUE`
    )
    console.log(`[Neo4J] Created constraints`)
  } catch (error) {
    console.error(`[Neo4J] Creating contraints failed`)
    throw error
  } finally {
    session.close()
  }
}

export const init = async () => {
  if (await get_connection_status()) {
    connected = true

    try {
      console.log("[Neo4J] Initializing DB")
      await create_admin_if_not_exists()
      await set_ids_to_nodes_without_ids()
      await create_constraints()
    } catch (error) {
      console.log(error)
    }
  } else {
    setTimeout(init, 10000)
  }
}

export const url = NEO4J_URL
export const get_connected = () => connected
