const request = require("supertest")
const expect = require("chai").expect
const app = require("../server.js").app
const user_controller = require('../controllers/users.js')

let jwt

// We will test for api users
describe("/users", () => {

  beforeEach( async () => {
    console.log = function () {};
    await user_controller.delete_all_users()
    await user_controller.create_admin_if_not_exists()
    const {body} = await request(app)
      .post("/auth/login")
      .send({username: 'admin', password: 'admin'})
    jwt = body.jwt
  })


  // We will test root GET related logics
  describe("GET /", () => {
    // What should it do
    it("Should return all users", async () => {

      const res = await request(app)
        .get("/users")
        .set('Authorization', `Bearer ${jwt}`)

      expect(res.status).to.equal(200)
      expect(res.body.length).to.equal(1)
    })
  })

  describe("POST /", () => {
    // What should it do
    it("Should prevent creation of user without password", async () => {

      const res = await request(app)
        .post("/users")
        .send({username: 'test_user'})
        .set('Authorization', `Bearer ${jwt}`)

      expect(res.status).to.equal(400)
    })

    it("Should prevent creation of user username", async () => {

      const res = await request(app)
        .post("/users")
        .send({password: 'banana'})
        .set('Authorization', `Bearer ${jwt}`)

      expect(res.status).to.equal(400)
    })

    it("Should allow creation of user with username and password", async () => {

      const res = await request(app)
        .post("/users")
        .send({username: 'test_user', password: 'banana'})
        .set('Authorization', `Bearer ${jwt}`)

      expect(res.status).to.equal(200)
    })
  })

  describe("GET /:user_id", () => {
    // What should it do

    it("Should get the new user", async () => {

      const {body: {identity}} = await request(app)
        .post("/users")
        .send({username: 'test_user', password: 'banana'})
        .set('Authorization', `Bearer ${jwt}`)

      const res = await request(app)
        .get(`/users/${identity}`)
        .set('Authorization', `Bearer ${jwt}`)

      expect(res.body.properties.username).to.equal('test_user')
      expect(res.status).to.equal(200)
    })

    it("Should reject invalid IDs", async () => {


      const res = await request(app)
        .get(`/users/banana`)
        .set('Authorization', `Bearer ${jwt}`)

      expect(res.status).to.not.equal(200)
    })
  })

  describe("DELETE /:user_id", () => {
    // What should it do

    it("Should allow the deletion of a user", async () => {

      const {body: {identity}} = await request(app)
        .post("/users")
        .send({username: 'test_user', password: 'banana'})
        .set('Authorization', `Bearer ${jwt}`)

      const res = await request(app)
        .delete(`/users/${identity}`)
        .set('Authorization', `Bearer ${jwt}`)

      expect(res.status).to.equal(200)
    })
  })

  describe("PATCH /:user_id", () => {
    // What should it do

    it("Should prevent username modification", async () => {

      const {body: {_id}} = await request(app)
        .post("/users")
        .send({username: 'test_user', password: 'banana'})
        .set('Authorization', `Bearer ${jwt}`)

      const res = await request(app)
        .patch(`/users/${_id}`)
        .send({username: 'not_test_user'})
        .set('Authorization', `Bearer ${jwt}`)

      expect(res.status).to.equal(403)
    })

    it("Should allow the update of a user", async () => {

      const {body: {_id}} = await request(app)
        .post("/users")
        .send({username: 'test_user', password: 'banana'})
        .set('Authorization', `Bearer ${jwt}`)

      const res = await request(app)
        .patch(`/users/${_id}`)
        .send({display_name: 'Test User'})
        .set('Authorization', `Bearer ${jwt}`)

      expect(res.status).to.equal(200)
    })
  })

})
