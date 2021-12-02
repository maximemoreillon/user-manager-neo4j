const request = require("supertest")
const expect = require("chai").expect
const {app} = require("../server.js")
const user_controller = require('../controllers/users.js')


const sleep = (delay) => new Promise(resolve => setTimeout(resolve,delay))

// We will test for api users
describe("/auth", () => {

  beforeEach( async () => {
    //console.log = function () {}
    await sleep(5000)
    //await user_controller.create_admin_if_not_exists()
  })


  // We will test root GET related logics
  describe("POST /login", () => {

    // What should it do
    it("Should allow admin login", async () => {
      const {status} = await request(app)
        .post("/auth/login")
        .send({username: 'admin', password: 'admin'})

      expect(status).to.equal(200)
    })

    it("Should not allow random user login", async () => {
      const {status} = await request(app)
        .post("/auth/login")
        .send({username: 'roger', password: 'banana'})

      expect(status).to.not.equal(200)
    })
  })

})
