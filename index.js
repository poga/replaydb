const hypercore = require('hypercore')
const _ = require('lodash')
const express = require('express')
const bodyParser = require('body-parser')
const events = require('events')
const inherits = require('inherits')
const assert = require('assert')
const path = require('path')
const mkdirp = require('mkdirp')
const JSONFeed = require('json-feed')

const DEFAULT_OPTS = {wait: 1000, maxWait: 5000}

function ReplayDB (storage, key, opts) {
  if (!(this instanceof ReplayDB)) return new ReplayDB(path, key, opts)

  if (!opts && key && !Buffer.isBuffer(key) && typeof key === 'object') {
    opts = key
    key = null
  }
  opts = Object.assign({}, DEFAULT_OPTS, opts)
  events.EventEmitter.call(this)

  this.path = storage
  this.buffer = new Buffer(0)
  this.flush = _.debounce(this.flushNow, opts.wait, {maxWait: opts.maxWait})
  this.ready = false
  this.metadataFeed = new JSONFeed(this.metadataPath(), key)
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
  mkdirp(this.metadataPath(), function () { self.metadataFeed.open(ready) })

  function ready () {
    self.metadataFeed.on('error', (err) => { self.emit('metadata error', err) })
    if (self.metadataFeed.feed.length === 0 && self.metadataFeed.feed.writable) return init(cb)
  }

  this.metadataFeed.on('update', function (newMetadata) {
    if (!self.feed) {
      self.feed = hypercore(self.feedPath(), self.metadataFeed.json.feed)
      self.feed.ready(function () {
        emit(newMetadata)
      })
    } else {
      emit(newMetadata)
    }

    function emit (newMetadata) {
      self.metadata = newMetadata
      self.emit('metadata', newMetadata)
    }
  })

  this.once('metadata', function (metadata) {
    self.ready = true
    cb()
  })

  function init (cb) {
    self.feed = hypercore(self.feedPath())
    self.feed.ready(() => {
      self.setMetadata({feed: self.feed.key.toString('hex')}, err => {
        if (err) return cb(err)
      })
    })
  }
}

ReplayDB.prototype.setMetadata = function (meta, cb) {
  this.metadataFeed.set(meta, cb)
}

ReplayDB.prototype.append = function (object) {
  this._checkReady()
  var row = {timestamp: Date.now(), data: object}
  this.buffer = Buffer.concat([this.buffer, new Buffer(JSON.stringify(row) + '\n')])
  this.flush()
}

ReplayDB.prototype.flushNow = function () {
  var temp = Buffer.from(this.buffer)
  this.buffer = new Buffer(0)
  this.feed.append(temp, (err) => {
    if (err) return this.emit('error', err)

    this.emit('flush', temp)
  })
}

ReplayDB.prototype.server = function (cb) {
  this._checkReady()

  var app = this.app = express()
  var self = this
  require('express-ws')(app)

  app.use(bodyParser.json())

  app.post('/', function (req, res) {
    if (Array.isArray(req.body)) {
      req.body.forEach(x => { self.append(x) })
    } else {
      self.append(req.body)
    }
    res.json({status: 'ok'})
  })

  app.ws('/ws', function (ws, res) {
    var listener = (data) => {
      ws.send(data.toString())
    }
    self.on('flush', listener)
    ws.on('close', () => {
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
