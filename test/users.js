const request = require("supertest")
const {expect} = require("chai")
const {app} = require("../server.js")
const dotenv = require('dotenv')
dotenv.config()

const sleep = (delay) => new Promise(resolve => setTimeout(resolve,delay))



// We will test for api users
describe("/users", () => {

  const {
    TEST_USERNAME = 'admin',
    TEST_PASSWORD = 'admin',
  } = process.env

  let jwt
  let new_user_id
  const new_user = {
    username: 'test_user',
    password: 'banana',
    password_confirm: 'banana'
  }


  before( async () => {
    //console.log = function () {}
    await sleep(1000)
    const {status, body} = await request(app)
      .post("/auth/login")
      .send({username: TEST_USERNAME, password: TEST_PASSWORD})

    if(status !== 200) throw `Login error`
    jwt = body.jwt
  })


  // We will test root GET related logics
  describe("GET /", () => {
    // What should it do
    it("Should return all users", async () => {

      const {status} = await request(app)
        .get("/users")
        .set('Authorization', `Bearer ${jwt}`)

      expect(status).to.equal(200)
    })
  })

  describe("POST /", () => {
    // What should it do
    it("Should prevent creation of user without password", async () => {

      const {status} = await request(app)
        .post("/users")
        .send({username: 'test_user'})
        .set('Authorization', `Bearer ${jwt}`)
      expect(status).to.equal(400)
    })

    it("Should prevent creation of user without username", async () => {

      const {status} = await request(app)
        .post("/users")
        .send({password: 'banana'})
        .set('Authorization', `Bearer ${jwt}`)
      expect(status).to.equal(400)
    })

    it("Should allow creation of user with username and password", async () => {

      const {status, body} = await request(app)
        .post("/users")
        .send(new_user)
        .set('Authorization', `Bearer ${jwt}`)

      if(body.properties) new_user_id = body.properties._id

      expect(status).to.equal(200)
    })
  })

  describe("GET /:user_id", () => {
    // What should it do

    it("Should get the new user", async () => {

      const res = await request(app)
        .get(`/users/${new_user_id}`)
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



  describe("PATCH /:user_id", () => {

    it("Should prevent username modification", async () => {

      const {status} = await request(app)
        .patch(`/users/${new_user_id}`)
        .send({username: 'not_test_user'})
        .set('Authorization', `Bearer ${jwt}`)

      expect(status).to.equal(403)
    })

    it("Should allow the update of a user", async () => {

      const {status} = await request(app)
        .patch(`/users/${new_user_id}`)
        .send({display_name: 'Test User'})
        .set('Authorization', `Bearer ${jwt}`)

      expect(status).to.equal(200)
    })
  })

  describe("PATCH /:user_id/password", () => {

    it("Should allow the update of a password", async () => {

      const {status} = await request(app)
        .patch(`/users/${new_user_id}/password`)
        .send({new_password: 'myNewPassword', new_password_confirm: 'myNewPassword'})
        .set('Authorization', `Bearer ${jwt}`)

      expect(status).to.equal(200)
    })
  })

  describe("DELETE /:user_id", () => {
    // What should it do

    it("Should allow the deletion of a user", async () => {

      const {status} = await request(app)
        .delete(`/users/${new_user_id}`)
        .set('Authorization', `Bearer ${jwt}`)

      expect(status).to.equal(200)
    })
  })

})
