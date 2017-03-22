const tape = require('tape')
const DB = require('..')
const tmp = require('tmp')
const replicate = require('./helpers/replicate')

tape('append 1 flush 1', function (t) {
  var dir = tmp.dirSync({unsafeCleanup: true})
  var db = new DB(dir.name, {wait: 100})
  db.open(test)

  function test () {
    db.append({foo: 'bar'})
    db.on('flush', buf => {
      t.same(JSON.parse(buf), {foo: 'bar'})
      dir.removeCallback()
      t.end()
    })
  }
})

tape('append n flush 1', function (t) {
  var dir = tmp.dirSync({unsafeCleanup: true})
  var db = new DB(dir.name, {wait: 100})
  db.open(test)

  const n = 5

  function test () {
    for (var i = 0; i < n; i++) {
      db.append({foo: 'bar' + i})
    }
    db.on('flush', buf => {
      var objects = buf.toString().trim().split('\n').map(x => JSON.parse(x))
      t.same(objects, [
        {foo: 'bar0'},
        {foo: 'bar1'},
        {foo: 'bar2'},
        {foo: 'bar3'},
        {foo: 'bar4'}
      ])
      dir.removeCallback()
      t.end()
    })
  }
})

tape('append 2 flush 2', function (t) {
  var dir = tmp.dirSync({unsafeCleanup: true})
  var db = new DB(dir.name, {wait: 100})
  db.open(test)

  function test () {
    db.append({foo: 'bar'})
    setTimeout(function () {
      db.append({foo: 'baz'})
    }, 500)
    var iter = 0
    db.on('flush', buf => {
      if (iter === 0) {
        t.same(JSON.parse(buf), {foo: 'bar'})
        iter++
      } else {
        t.same(JSON.parse(buf), {foo: 'baz'})
        dir.removeCallback()
        t.end()
      }
    })
  }
})

tape('replicate & append 1 flush 1', function (t) {
  var dir = tmp.dirSync({unsafeCleanup: true})
  var db = new DB(dir.name, {wait: 100})
  var clone
  db.open(function () {
    var clonePath = tmp.dirSync({unsafeCleanup: true})
    clone = new DB(clonePath.name, db.metadataFeed.key)
    replicate(db.metadataFeed, clone.metadataFeed, {live: true})
    clone.open(test)
  })

  function test () {
    replicate(db.feed, clone.feed, {live: true})
    db.append({foo: 'bar'})
    db.on('flush', buf => {
      clone.feed.get(0, function (err, data) {
        t.error(err)
        t.same(JSON.parse(data), {foo: 'bar'})
        dir.removeCallback()
        t.end()
      })
    })
  }
})
