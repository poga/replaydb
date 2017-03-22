const tape = require('tape')
const DB = require('..')
const tmp = require('tmp')
const replicate = require('./helpers/replicate')

tape('init metadata', function (t) {
  var dir = tmp.dirSync({unsafeCleanup: true})
  var db = new DB(dir.name)
  db.open(test)

  function test () {
    t.ok(db.metadata.key, 'metadata should be inited')
    dir.removeCallback()
    t.end()
  }
})

tape('read metadata', function (t) {
  var dir = tmp.dirSync({unsafeCleanup: true})
  var db = new DB(dir.name)
  db.open(test)

  function test () {
    var db2 = new DB(dir.name)
    db2.open(function () {
      t.same(db2.metadata, db.metadata, 'read metadata after open')
      dir.removeCallback()
      t.end()
    })
  }
})

tape('update metadata', function (t) {
  var dir = tmp.dirSync({unsafeCleanup: true})
  var db = new DB(dir.name)
  db.open(test)

  function test () {
    db.setMetadata(Object.assign({}, db.metadata, {foo: 'bar'}), function (err) {
      t.error(err)
      t.same(db.metadata, {key: db.metadataFeed.key.toString('hex'), foo: 'bar'}, 'metadata updated')
      dir.removeCallback()
      t.end()
    })
  }
})

tape('emit metadata event', function (t) {
  var dir = tmp.dirSync({unsafeCleanup: true})
  var db = new DB(dir.name)
  var i = 0
  db.on('metadata', (meta) => {
    if (i === 0) {
      t.same(meta, {key: db.metadataFeed.key.toString('hex')}, 'first metadata event')
      i++
    } else {
      t.same(meta, {
        key: db.metadataFeed.key.toString('hex'),
        foo: 'bar'
      }, 'second metadata event')
      t.end()
    }
  })
  db.open(test)

  function test () {
    db.setMetadata(Object.assign({}, db.metadata, {foo: 'bar'}), function (err) {
      t.error(err)
      t.same(db.metadata, {key: db.metadataFeed.key.toString('hex'), foo: 'bar'}, 'metadata updated')
    })
  }
})

tape('update metadata & replicate', function (t) {
  var dir = tmp.dirSync({unsafeCleanup: true})
  var db = new DB(dir.name)
  var clone
  var dirClone = tmp.dirSync({unsafeCleanup: true})
  db.open(function () {
    clone = new DB(dirClone.name, db.metadataFeed.key)
    replicate(db.metadataFeed, clone.metadataFeed)
    clone.open(test)
  })

  function test () {
    console.log('test')
    console.log(clone.metadataFeed.length)

    db.setMetadata(Object.assign({}, db.metadata, {foo: 'bar'}), function (err) {
      t.error(err)
      console.log('set done')
    })

    clone.on('metadata', (metadata) => {
      console.log(metadata)
      t.same(db.metadata, {key: db.metadataFeed.key.toString('hex'), foo: 'bar'}, 'metadata updated')
      dir.removeCallback()
      t.end()
    })
  }
})