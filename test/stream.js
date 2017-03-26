
const tape = require('tape')
const DB = require('..')
const tmp = require('tmp')
const collect = require('collect-stream')

tape('createReadStream', function (t) {
  var dir = tmp.dirSync()
  var db = new DB(dir.name, {wait: 100})
  db.open(test)

  function test () {
    db.append({foo: 'bar'})

    db.on('flush', buf => {
      var rs = db.createReadStream()
      collect(rs, function (err, data) {
        t.error(err)
        t.equal(data.length, 1)
        t.same(data[0].data, {foo: 'bar'})
        t.end()
      })
    })
  }
})

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
