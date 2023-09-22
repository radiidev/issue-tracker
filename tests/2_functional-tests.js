const chaiHttp = require("chai-http");
const chai = require("chai");
const assert = chai.assert;
const server = require("../server");
const { randomBytes } = require("node:crypto");

const randomString = (length) => randomBytes(length).toString("base64");
const randomIndex = (length) => {
  const index = Math.trunc(Math.random() * length);
  return index < length ? index : length - 1;
};

chai.use(chaiHttp);

suite("Functional Tests", function () {
  this.timeout(5000);
  const project = randomBytes(15).toString("hex");
  let issues = [];
  const filters = [
    "issue_title",
    "issue_text",
    "created_by",
    "assigned_to",
    "status_text",
  ];
  test("Create an issue with every field: POST request to /api/issues/{project}", (done) => {
    const issue = {
      issue_title: randomString(25),
      issue_text: randomString(200),
      created_by: randomString(12),
      assigned_to: randomString(17),
      status_text: randomString(8),
    };
    const beforeRequest = new Date().getTime();
    chai
      .request(server)
      .keepOpen()
      .post(`/api/issues/${project}`)
      .set("content-type", "application/x-www-form-urlencoded")
      .send(issue)
      .end(function (err, res) {
        const afterRequest = new Date().getTime();
        assert.equal(res.status, 200);
        Object.entries({ ...issue, open: true }).forEach(([k, v]) =>
          assert.strictEqual(v, res.body[k])
        );
        assert.isAtLeast(Date.parse(res.body["created_on"]), beforeRequest);
        assert.isAtMost(Date.parse(res.body["created_on"]), afterRequest);
        assert.isAtLeast(Date.parse(res.body["updated_on"]), beforeRequest);
        assert.isAtMost(Date.parse(res.body["updated_on"]), afterRequest);
        assert.isNotEmpty(res.body._id);
        issues.push(res.body);
        done();
      });
  });

  test("Create an issue with only required fields: POST request to /api/issues/{project}", (done) => {
    const issue = {
      issue_title: randomString(25),
      issue_text: randomString(200),
      created_by: randomString(12),
    };
    const beforeRequest = new Date().getTime();
    chai
      .request(server)
      .keepOpen()
      .post(`/api/issues/${project}`)
      .set("content-type", "application/x-www-form-urlencoded")
      .send(issue)
      .end(function (err, res) {
        const afterRequest = new Date().getTime();
        assert.equal(res.status, 200);
        Object.entries({ ...issue, open: true }).forEach(([k, v]) =>
          assert.strictEqual(v, res.body[k])
        );
        assert.isAtLeast(Date.parse(res.body["created_on"]), beforeRequest);
        assert.isAtMost(Date.parse(res.body["created_on"]), afterRequest);
        assert.isAtLeast(Date.parse(res.body["updated_on"]), beforeRequest);
        assert.isAtMost(Date.parse(res.body["updated_on"]), afterRequest);
        assert.isNotEmpty(res.body._id);
        assert.strictEqual(res.body["assigned_to"], "");
        assert.strictEqual(res.body["status_text"], "");
        issues.push(res.body);
        done();
      });
  });

  test("Create an issue with missing required fields: POST request to /api/issues/{project}", (done) => {
    const issue = {
      issue_title: randomString(25),
      created_by: randomString(12),
      status_text: randomString(8),
    };
    chai
      .request(server)
      .keepOpen()
      .post(`/api/issues/${project}`)
      .set("content-type", "application/x-www-form-urlencoded")
      .send(issue)
      .end(function (err, res) {
        assert.equal(res.status, 400);
        assert.deepEqual({ error: "required field(s) missing" }, res.body);
        done();
      });
  });

  test("View issues on a project: GET request to /api/issues/{project}", (done) => {
    chai
      .request(server)
      .keepOpen()
      .get(`/api/issues/${project}`)
      .end(function (err, res) {
        assert.equal(res.status, 200);
        assert.isArray(res.body);
        assert.lengthOf(res.body, issues.length);
        issues.forEach((issue) => {
          for (const i of res.body) {
            if (i.issue_title == issue.issue_title) return;
          }
          assert.fail("Did not find following issue in GET response:", issue);
        });
        done();
      });
  });

  test("View issues on a project with one filter: GET request to /api/issues/{project}", (done) => {
    const random_filter = filters[randomIndex(filters.length)];
    const random_issue = issues[randomIndex(issues.length)];
    chai
      .request(server)
      .keepOpen()
      .get(
        `/api/issues/${project}?${random_filter}=${encodeURIComponent(
          random_issue[random_filter]
        )}`
      )
      .end(function (err, res) {
        assert.equal(res.status, 200);
        assert.isArray(res.body);
        assert.isNotEmpty(res.body);
        if (
          !res.body.some(
            (issue) => issue.issue_title === random_issue.issue_title
          )
        )
          assert.fail(
            "Did not find following issue in GET response:",
            random_issue
          );
        done();
      });
  });

  test("View issues on a project with multiple filters: GET request to /api/issues/{project}", (done) => {
    const random_filters = [];
    for (
      let i = 0, filters_count = randomIndex(filters.length) + 1;
      i < filters_count || i < 2;
      i++
    ) {
      random_filters.push(filters[randomIndex(filters.length)]);
    }
    const random_issue = issues[randomIndex(issues.length)];
    const query = random_filters
      .map((filter) => `${filter}=${encodeURIComponent(random_issue[filter])}`)
      .join("&");
    chai
      .request(server)
      .keepOpen()
      .get(`/api/issues/${project}?${query}`)
      .end(function (err, res) {
        assert.equal(res.status, 200);
        assert.isArray(res.body);
        assert.isNotEmpty(res.body);
        if (
          !res.body.some(
            (issue) => issue.issue_title === random_issue.issue_title
          )
        )
          assert.fail(
            "Did not find following issue in GET response:",
            random_issue
          );
        done();
      });
  });

  test("Update one field on an issue: PUT request to /api/issues/{project}", (done) => {
    const random_field = filters[randomIndex(filters.length)];
    const issue_index = randomIndex(issues.length);
    const random_issue = issues[issue_index];
    const updated_field = randomString(20);
    random_issue[random_field] = updated_field;
    const request = { _id: random_issue["_id"], [random_field]: updated_field };
    chai
      .request(server)
      .keepOpen()
      .put(`/api/issues/${project}`)
      .set("content-type", "application/x-www-form-urlencoded")
      .send(request)
      .end(function (err, res) {
        assert.equal(res.status, 200);
        assert.deepEqual(
          {
            result: "successfully updated",
            _id: random_issue["_id"],
          },
          res.body
        );
        issues[issue_index] = random_issue;
        done();
      });
  });

  test("Update multiple fields on an issue: PUT request to /api/issues/{project}", (done) => {
    const issue_index = randomIndex(issues.length);
    const random_issue = { ...issues[issue_index] };
    for (const k in random_issue) {
      if (k != "_id") random_issue[k] = randomString(20);
    }
    chai
      .request(server)
      .keepOpen()
      .put(`/api/issues/${project}`)
      .set("content-type", "application/x-www-form-urlencoded")
      .send(random_issue)
      .end(function (err, res) {
        assert.equal(res.status, 200);
        assert.deepEqual(
          {
            result: "successfully updated",
            _id: random_issue["_id"],
          },
          res.body
        );
        issues[issue_index] = random_issue;
        done();
      });
  });

  test("Update an issue with missing _id: PUT request to /api/issues/{project}", (done) => {
    const issue = {
      issue_title: randomString(25),
      issue_text: randomString(200),
      created_by: randomString(12),
      assigned_to: randomString(17),
      status_text: randomString(8),
    };
    chai
      .request(server)
      .keepOpen()
      .put(`/api/issues/${project}`)
      .set("content-type", "application/x-www-form-urlencoded")
      .send(issue)
      .end(function (err, res) {
        assert.equal(res.status, 400);
        assert.deepEqual({ error: "missing _id" }, res.body);
        done();
      });
  });

  test("Update an issue with no fields to update: PUT request to /api/issues/{project}", (done) => {
    const random_id = issues[randomIndex(issues.length)]._id;
    chai
      .request(server)
      .keepOpen()
      .put(`/api/issues/${project}`)
      .set("content-type", "application/x-www-form-urlencoded")
      .send({ _id: random_id })
      .end(function (err, res) {
        assert.equal(res.status, 400);
        assert.deepEqual(
          { error: "no update field(s) sent", _id: random_id },
          res.body
        );
        done();
      });
  });

  test("Update an issue with an invalid _id: PUT request to /api/issues/{project}", (done) => {
    const issue_index = randomIndex(issues.length);
    const random_issue = { ...issues[issue_index] };
    for (const k in random_issue) {
      random_issue[k] = randomString(20);
    }
    chai
      .request(server)
      .keepOpen()
      .put(`/api/issues/${project}`)
      .set("content-type", "application/x-www-form-urlencoded")
      .send(random_issue)
      .end(function (err, res) {
        assert.equal(res.status, 404);
        assert.deepEqual(
          { error: "could not update", _id: random_issue._id },
          res.body
        );
        done();
      });
  });

  test("Delete an issue: DELETE request to /api/issues/{project}", (done) => {
    const random_id = issues[randomIndex(issues.length)]._id;
    chai
      .request(server)
      .keepOpen()
      .delete(`/api/issues/${project}`)
      .set("content-type", "application/x-www-form-urlencoded")
      .send({ _id: random_id })
      .end(function (err, res) {
        assert.equal(res.status, 200);
        assert.deepEqual(
          { result: "successfully deleted", _id: random_id },
          res.body
        );
        issues = issues.filter((issue) => issue._id != random_id);
        done();
      });
  });

  test("Delete an issue with an invalid _id: DELETE request to /api/issues/{project}", (done) => {
    const random_id = randomString(20);
    chai
      .request(server)
      .keepOpen()
      .delete(`/api/issues/${project}`)
      .set("content-type", "application/x-www-form-urlencoded")
      .send({ _id: random_id })
      .end(function (err, res) {
        assert.equal(res.status, 404);
        assert.deepEqual(
          { error: "could not delete", _id: random_id },
          res.body
        );
        done();
      });
  });

  test("Delete an issue with missing _id: DELETE request to /api/issues/{project}", (done) => {
    chai
      .request(server)
      .keepOpen()
      .delete(`/api/issues/${project}`)
      .set("content-type", "application/x-www-form-urlencoded")
      .send({})
      .end(function (err, res) {
        assert.equal(res.status, 400);
        assert.deepEqual({ error: "missing _id" }, res.body);
        done();
      });
  });
});
