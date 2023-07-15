import request from "supertest"
import { expect } from "chai"
import { app } from "../index"
import dotenv from "dotenv"
dotenv.config()

const sleep = (delay: number) =>
  new Promise((resolve) => setTimeout(resolve, delay))

// We will test for api users
describe("/users", () => {
  const { TEST_USERNAME = "admin", TEST_PASSWORD = "admin" } = process.env

  let jwt: string, new_user_id: string

  const new_user = {
    username: "test_user",
    password: "banana",
    password_confirm: "banana",
  }

  before(async () => {
    //console.log = function () {}
    await sleep(1000) // wait for admin to be created
    const { status, body } = await request(app)
      .post("/auth/login")
      .send({ username: TEST_USERNAME, password: TEST_PASSWORD })

    if (status !== 200) throw `Login error`
    jwt = body.jwt
  })

  describe("POST /users", () => {
    // What should it do
    it("Should prevent creation of user without password", async () => {
      const { status } = await request(app)
        .post("/users")
        .send({ username: "test_user" })
        .set("Authorization", `Bearer ${jwt}`)
      expect(status).to.equal(400)
    })

    it("Should prevent creation of user without username", async () => {
      const { status } = await request(app)
        .post("/users")
        .send({ password: "banana" })
        .set("Authorization", `Bearer ${jwt}`)
      expect(status).to.equal(400)
    })

    it("Should allow creation of user with username and password", async () => {
      const { status, body } = await request(app)
        .post("/users")
        .send(new_user)
        .set("Authorization", `Bearer ${jwt}`)

      new_user_id = body._id

      expect(status).to.equal(200)
    })
  })

  describe("GET /users", () => {
    it("Should allow the query of users", async () => {
      const { status, body } = await request(app)
        .get("/users")
        .set("Authorization", `Bearer ${jwt}`)

      expect(status).to.equal(200)
      expect(body.users.length).to.be.above(0)
    })

    it("Should allow the query of users with a list of IDs", async () => {
      const { status, body } = await request(app)
        .get("/users")
        .query({ ids: [new_user_id] })
        .set("Authorization", `Bearer ${jwt}`)

      expect(status).to.equal(200)
      expect(body.users.length).to.be.above(0)
    })

    it("Should not find users when using with a list of invalid IDs", async () => {
      const { status, body } = await request(app)
        .get("/users")
        .query({ ids: ["aaa", "bbb"] })
        .set("Authorization", `Bearer ${jwt}`)

      expect(status).to.equal(200)
      expect(body.users.length).to.equal(0)
    })

    it("Should allow the query of users with a search string", async () => {
      const { status, body } = await request(app)
        .get("/users")
        .query({ search: "test" })
        .set("Authorization", `Bearer ${jwt}`)

      expect(status).to.equal(200)
      expect(body.users.length).to.be.above(0)
    })

    it("Should not find users when using an invalid search string", async () => {
      const { status, body } = await request(app)
        .get("/users")
        .query({ search: "opasdijkopasdik" })
        .set("Authorization", `Bearer ${jwt}`)

      expect(status).to.equal(200)
      expect(body.users.length).to.equal(0)
    })

    it("Should not allow the anonymous query of all users", async () => {
      const { status } = await request(app).get("/users")
      expect(status).to.equal(403)
    })
  })

  describe("GET /users/:user_id", () => {
    // What should it do

    it("Should get the new user", async () => {
      const { status, body } = await request(app)
        .get(`/users/${new_user_id}`)
        .set("Authorization", `Bearer ${jwt}`)

      expect(body.username).to.equal("test_user")
      expect(status).to.equal(200)
    })

    it("Should reject invalid IDs", async () => {
      const res = await request(app)
        .get(`/users/jkasdaskljasdklj`)
        .set("Authorization", `Bearer ${jwt}`)

      expect(res.status).to.not.equal(200)
    })
  })

  describe("PATCH /users/:user_id", () => {
    it("Should prevent username modification", async () => {
      const { status } = await request(app)
        .patch(`/users/${new_user_id}`)
        .send({ username: "not_test_user" })
        .set("Authorization", `Bearer ${jwt}`)

      expect(status).to.equal(403)
    })

    it("Should prevent modification of non-existent user", async () => {
      const { status } = await request(app)
        .patch(`/users/3453456345`)
        .send({ display_name: "Test User" })
        .set("Authorization", `Bearer ${jwt}`)

      expect(status).to.equal(404)
    })

    it("Should allow the update of a user", async () => {
      const { status } = await request(app)
        .patch(`/users/${new_user_id}`)
        .send({ display_name: "Test User" })
        .set("Authorization", `Bearer ${jwt}`)

      expect(status).to.equal(200)
    })
  })

  describe("PATCH /users/:user_id/password", () => {
    it("Should allow the update of a password", async () => {
      const { status } = await request(app)
        .patch(`/users/${new_user_id}/password`)
        .send({
          new_password: "myNewPassword",
          new_password_confirm: "myNewPassword",
        })
        .set("Authorization", `Bearer ${jwt}`)

      expect(status).to.equal(200)
    })
  })

  describe("DELETE /users/:user_id", () => {
    // What should it do

    it("Should allow the deletion of a user", async () => {
      const { status } = await request(app)
        .delete(`/users/${new_user_id}`)
        .set("Authorization", `Bearer ${jwt}`)

      expect(status).to.equal(200)
    })

    it("Should prevent the deletion of an inexistent user", async () => {
      const { status } = await request(app)
        .delete(`/users/asdasdasd`)
        .set("Authorization", `Bearer ${jwt}`)

      expect(status).to.equal(404)
    })
  })
})
