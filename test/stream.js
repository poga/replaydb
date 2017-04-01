
const tape = require('tape')
const DB = require('..')
const tmp = require('tmp')
const collect = require('collect-stream')

tape('createReadStream', function (t) {
  var dir = tmp.dirSync()
  var db = new DB(dir.name, {wait: 100})
  db.open(test)

  function test () {
    db.append({foo: 'bar1'})
    db.append({foo: 'bar2'})
    db.append({foo: 'bar3'})
    db.append({foo: 'bar4'})

    db.on('flush', buf => {
      var rs = db.createReadStream()
      collect(rs, function (err, data) {
        t.error(err)
        t.equal(data.length, 4)
        t.same(data.map(x => x.data.foo), ['bar1', 'bar2', 'bar3', 'bar4'])
        t.end()
      })
    })
  }
})

tape('createReadStream with lastReceived', function (t) {
  var dir = tmp.dirSync()
  var db = new DB(dir.name, {wait: 100})
  db.open(test)

  function test () {
    db.append({foo: 'bar1'})
    db.append({foo: 'bar2'})
    db.append({foo: 'bar3'})
    db.append({foo: 'bar4'})

    db.on('flush', buf => {
      t.ok(buf[1].ID)
      var rs = db.createReadStream({lastReceived: buf[1].ID})
      collect(rs, function (err, data) {
        t.error(err)
        t.equal(data.length, 3)
        t.same(data.map(x => x.data.foo), ['bar2', 'bar3', 'bar4'])
        t.end()
      })
    })
  }
})

tape('createReadStream with startAt', function (t) {
  var dir = tmp.dirSync()
  var db = new DB(dir.name, {wait: 100})
  db.open(test)

  function test () {
    db.append({foo: 'bar1'})
    db.append({foo: 'bar2'})

    db.once('flush', buf => {
      db.append({foo: 'bar3'})
      db.append({foo: 'bar4'})
      db.once('flush', buf2 => {
        var start = buf2[0].timestamp
        t.ok(start)
        var rs = db.createReadStream({startAt: start})
        collect(rs, function (err, data) {
          t.error(err)
          t.equal(data.length, 2)
          t.same(data.map(x => x.data.foo), ['bar3', 'bar4'])
          t.end()
        })
      })
    })
  }
})

tape('createReadStream with startAt & start at middle of a block', function (t) {
  var dir = tmp.dirSync()
  var db = new DB(dir.name, {wait: 100})
  db.open(test)

  function test () {
    db.append({foo: 'bar1'})
    setTimeout(() => {
      db.append({foo: 'bar2'})
    }, 10)

    db.once('flush', buf => {
      db.append({foo: 'bar3'})
      db.append({foo: 'bar4'})
      var start = buf[1].timestamp
      t.ok(start)
      db.once('flush', buf2 => {
        var rs = db.createReadStream({startAt: start})
        collect(rs, function (err, data) {
          t.error(err)
          t.equal(data.length, 3)
          t.same(data.map(x => x.data.foo), ['bar2', 'bar3', 'bar4'])
          t.end()
        })
      })
    })
  }
})
