const tape = require('tape')
const hyperdrive = require('hyperdrive')
const memdb = require('memdb')
const request = require('superagent')
const ReplayDB = require('.')
const WS = require('ws')

tape('basic', function (t) {
  var drive = hyperdrive(memdb())
  var archive = drive.createArchive()
  var rdb = new ReplayDB(archive)

  var socket = new WS('ws://localhost:8080/live/hello/0')
  socket.on('message', (data) => {
    data = JSON.parse(data)
    t.same(data.offset, 0)
    t.same(JSON.parse(data.payload), {foo: 'bar'})
    t.ok(data.timestamp)
    get()
  })

  rdb.listen(8080, () => {
    post()
  })

  function post () {
    request
      .post('http://localhost:8080/hello')
      .send({foo: 'bar'})
      .end(function (err, res) {
        t.error(err)
      })
  }

  function get () {
    request
      .get('http://localhost:8080/hello/0')
      .end(function (err, res) {
        t.error(err)
        t.same(res.body.offset, 0)
        t.same(JSON.parse(res.body.payload), {foo: 'bar'})
        t.ok(res.body.timestamp)

        t.end()
        socket.close()
        rdb.close()
      })
  }
})
