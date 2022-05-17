const {Router} = require('express')
const auth_router = require('./auth.js')
const users_router = require('./users.js')
const { commit } = require('../../commit.json')
const { smtp } = require('../../mail.js')
const { version, author } = require('../../package.json')
const { 
    url: neo4j_url, 
    get_connected, 
    get_initialized
} = require('../../db.js')

const router = Router()

router.get('/', (req, res) => {
    res.send({
        application_name: 'User manager (Neo4J version)',
        author,
        version,
        commit,
        neo4j: {
            url: neo4j_url,
            connected: get_connected(),
            initialized: get_initialized()
        },
        smtp,
    })
})

router.use('/auth', auth_router)
router.use('/users', users_router)


module.exports = router
