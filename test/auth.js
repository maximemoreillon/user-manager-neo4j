const request = require("supertest")
const expect = require("chai").expect
const app = require("../server.js").app
const user_controller = require('../controllers/users.js')


// We will test for api users
describe("/auth", () => {

  beforeEach( async () => {
    console.log = function () {};
    await user_controller.create_admin_if_not_exists()
  })


  // We will test root GET related logics
  describe("POST /login", () => {

    // What should it do
    it("Should return 200", async () => {
      const {status} = await request(app)
        .post("/auth/login")
        .send({username: 'admin', password: 'admin'})

      expect(status).to.equal(200)
    })
  })

})
