const tape = require('tape')
const DB = require('..')
const request = require('superagent')
const tmp = require('tmp')
const WebSocket = require('ws')

tape('post', function (t) {
  var dir = tmp.dirSync()
  var db = new DB(dir.name)

  db.open(test)
  var server

  db.once('flush', data => {
    t.same(JSON.parse(data), {foo: 'bar'})
    t.end()
    server.close()
  })

  function test () {
    var app = db.server()
    server = app.listen(9090, function () {
      request
      .post('http://localhost:9090/')
      .send({foo: 'bar'})
      .end(check)
    })
  }

  function check (err, res) {
    t.error(err)
    t.same(res.body, {status: 'ok'})
  }
})

tape('ws', function (t) {
  var dir = tmp.dirSync()
  var db = new DB(dir.name)

  db.open(test)
  var server

  function test () {
    var app = db.server()
    server = app.listen(9090, function () {
      var socket = new WebSocket('ws://localhost:9090/live')
      socket.on('message', x => {
        t.same(JSON.parse(x), {foo: 'bar'})
        server.close()
        t.end()
        socket.close()
      })

      request
        .post('http://localhost:9090/')
        .send({foo: 'bar'})
        .end(check)
    })
  }

  function check (err, res) {
    t.error(err)
    t.same(res.body, {status: 'ok'})
  }
})
