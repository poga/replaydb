const hypercore = require('hypercore')
const _ = require('lodash')
const express = require('express')
const bodyParser = require('body-parser')
const events = require('events')
const inherits = require('inherits')
const assert = require('assert')
const jsonpatch = require('fast-json-patch')
const path = require('path')
const mkdirp = require('mkdirp')

function ReplayDB (storage, key) {
  if (!(this instanceof ReplayDB)) return new ReplayDB(path, key)
  events.EventEmitter.call(this)

  this.path = storage
  this.buffer = new Buffer(0)
  this.flush = _.debounce(this.flushNow, 1000, {maxWait: 5000})
  this.ready = false
  this.metadatakey = key
  this.metadataFeed = hypercore(this.metadataPath(), key)
  this.metadata = {} // aggregated matadata JSON
  this.feed = undefined
}

inherits(ReplayDB, events.EventEmitter)

ReplayDB.prototype.metadataPath = function () {
  return path.join(this.path, '.metadata')
}

ReplayDB.prototype.feedPath = function () {
  return this.path
}

ReplayDB.prototype.open = function (cb) {
  var self = this
  mkdirp(this.metadataPath(), function () { self.metadataFeed.ready(ready) })

  function ready () {
    console.log('ready', self.metadataFeed.length, self.metadataFeed.writable)
    self.metadataFeed.on('error', (err) => { self.emit('metadata error', err) })
    if (self.metadataFeed.length === 0 && self.metadataFeed.writable) return init(cb)

    readMetadata()
  }

  self.once('metadata', function (metadata) {
    self.ready = true
    cb()
  })

  function readMetadata () {
    console.log('reading metadata')
    var rs = self.metadataFeed.createReadStream({live: true})
    var i = 0
    rs.on('data', patches => {
      var p = JSON.parse(patches)
      jsonpatch.apply(self.metadata, p)
      i += 1
      console.log('read', p, i)
      console.log('emitting metadata', self.metadata, self.feed)

      if (i === self.metadataFeed.length) {
        if (!self.feed) {
          self.feed = hypercore(self.feedPath(), self.metadata.feed)
          self.feed.ready(() => {
            self.emit('metadata', self.metadata)
          })
        } else {
          self.emit('metadata', self.metadata)
        }
      }
    })
  }

  function init (cb) {
    console.log('init')
    readMetadata()
    self.feed = hypercore(self.feedPath())
    self.feed.ready(() => {
      self.setMetadata({feed: self.feed.key.toString('hex')}, err => {
        if (err) return cb(err)
      })
    })
  }
}

ReplayDB.prototype.setMetadata = function (meta, cb) {
  console.log('setting metadata', meta, cb)
  var diff = jsonpatch.compare(this.metadata, meta)
  this.metadataFeed.append(JSON.stringify(diff), err => {
    if (err) return cb(err)
    this.once('metadata', (metadata) => { cb(null, metadata) })
    console.log('done', err, this.metadata)
  })
}

ReplayDB.prototype.append = function (object) {
  this._checkReady()
  this.buffer = Buffer.concat([this.buffer, new Buffer(JSON.stringify(object) + '\n')])
  this.flush()
}

ReplayDB.prototype.flushNow = function () {
  console.log(this.buffer.toString().split('\n').length, 'flushed')
  var temp = Buffer.from(this.buffer)
  this.buffer = new Buffer(0)
  this.feed.append(temp, (err) => {
    if (err) return this.emit('error', err)

    this.emit('flush', temp)
    console.log('append done')
  })
}

ReplayDB.prototype.server = function (cb) {
  this._checkReady()

  var app = this.app = express()
  var self = this
  require('express-ws')(app)

  app.use(bodyParser.json())

  app.post('/:topic', function (req, res) {
    self.append(req.body)
    res.json({status: 'ok'})
  })

  app.ws('/live/:topic', function (ws, res) {
    console.log('live')
    var listener = (data) => {
      console.log('live', data.length)
      ws.send(data)
    }
    self.on('flush', listener)
    ws.on('close', () => {
      console.log('close')
      self.removeListener('flush', listener)
    })
  })

  app.use(function (err, req, res, next) {
    console.error(err.stack)
    res.status(500).send('Something went wrong')
  })

  return app
}

ReplayDB.prototype._checkReady = function () {
  assert(this.ready, 'DB not ready. call open() before use')
}

module.exports = ReplayDB
