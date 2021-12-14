const request = require("supertest")
const expect = require("chai").expect
const {app} = require("../server.js")


const sleep = (delay) => new Promise(resolve => setTimeout(resolve,delay))

const {
  TEST_USERNAME = 'admin',
  TEST_PASSWORD = 'admin',
} = process.env


// We will test for api users
describe("/v2/auth", () => {

  before( async () => {
    //console.log = function () {}
    await sleep(7000) // wait for admin to be created
  })


  // We will test root GET related logics
  describe("POST /v2/auth/login", () => {

    // What should it do
    it("Should allow admin login", async () => {
      const {status} = await request(app)
        .post("/v2/auth/login")
        .send({username: TEST_USERNAME, password: TEST_PASSWORD})

      expect(status).to.equal(200)
    })

    it("Should not allow random user login", async () => {
      const {status} = await request(app)
        .post("/v2/auth/login")
        .send({username: 'roger', password: 'banana'})

      expect(status).to.not.equal(200)
    })
  })

})
