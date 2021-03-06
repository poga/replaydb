const tape = require('tape')
const DB = require('..')
const tmp = require('tmp')
const replicate = require('./helpers/replicate')

tape('append 1 flush 1', function (t) {
  var dir = tmp.dirSync()
  var db = new DB(dir.name, {wait: 100})
  db.open(test)

  function test () {
    db.append({foo: 'bar'})
    db.on('flush', buf => {
      t.ok(buf[0].timestamp)
      t.ok(buf[0].ID)
      t.same(buf[0].data, {foo: 'bar'})
      t.end()
    })
  }
})

tape('append 1 flush 1 & find', function (t) {
  var dir = tmp.dirSync()
  var db = new DB(dir.name, {wait: 100})
  db.open(test)

  function test () {
    db.append({foo: 'bar'})
    db.on('flush', buf => {
      var ts = buf[0].timestamp
      t.ok(ts)
      t.ok(buf[0].ID)
      t.same(buf[0].data, {foo: 'bar'})
      var blockID = db.findBlock(ts)
      t.equal(blockID, 0)
      blockID = db.findBlock(ts + 1)
      t.equal(blockID, undefined)
      blockID = db.findBlock(ts - 1)
      t.equal(blockID, undefined)
      t.end()
    })
  }
})

tape('append & update metadata', function (t) {
  var dir = tmp.dirSync()
  var db = new DB(dir.name, {wait: 100})
  db.open(test)

  function test () {
    db.append({foo: 'bar'})
    db.on('flush', buf => {
      t.equal(db.metadata.index.length, 1)
      t.equal(db.metadata.index[0].block, 0)
      t.ok(db.metadata.index[0].startAt, 0)
      t.ok(db.metadata.index[0].endAt, 0)
      t.end()
    })
  }
})

tape('append n flush 1', function (t) {
  var dir = tmp.dirSync()
  var db = new DB(dir.name, {wait: 100})
  db.open(test)

  const n = 5

  function test () {
    for (var i = 0; i < n; i++) {
      db.append({foo: 'bar' + i})
    }
    db.on('flush', buf => {
      t.same(buf.map(x => x.data), [
        {foo: 'bar0'},
        {foo: 'bar1'},
        {foo: 'bar2'},
        {foo: 'bar3'},
        {foo: 'bar4'}
      ])
      // one flush = one index
      t.equal(db.metadata.index.length, 1)
      t.equal(db.metadata.index[0].block, 0)
      t.end()
    })
  }
})

tape('append 2 flush 2', function (t) {
  var dir = tmp.dirSync()
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
        t.ok(buf[0].timestamp)
        t.ok(buf[0].ID)
        t.same(buf[0].data, {foo: 'bar'})
        iter++
      } else {
        t.ok(buf[0].timestamp)
        t.ok(buf[0].ID)
        t.same(buf[0].data, {foo: 'baz'})
        // two flush = one index
        t.equal(db.metadata.index.length, 2)
        t.equal(db.metadata.index[0].block, 0)
        t.equal(db.metadata.index[1].block, 1)
        t.end()
      }
    })
  }
})

tape('replicate & append 1 flush 1', function (t) {
  var dir = tmp.dirSync()
  var db = new DB(dir.name, {wait: 100})
  var clone
  db.open(function () {
    var clonePath = tmp.dirSync({unsafeCleanup: true})
    clone = new DB(clonePath.name, db.metadataFeed.feed.key)
    replicate(db.metadataFeed.feed, clone.metadataFeed.feed, {live: true})
    clone.open(test)
  })

  function test () {
    replicate(db.feed, clone.feed, {live: true})
    db.append({foo: 'bar'})
    db.on('flush', buf => {
      clone.feed.get(0, function (err, data) {
        t.error(err)
        t.same(JSON.parse(data).data, {foo: 'bar'})
        t.end()
      })
    })
  }
})
