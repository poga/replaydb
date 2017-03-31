const hypercore = require('hypercore')
const _ = require('lodash')
const express = require('express')
const bodyParser = require('body-parser')
const events = require('events')
const inherits = require('inherits')
const assert = require('assert')
const path = require('path')
const mkdirp = require('mkdirp')
const ObjectFeed = require('object-feed')
const uuid = require('uuid/v4')
const ndjson = require('ndjson')
const through2 = require('through2')

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
  this.buffer = []
  this.flush = _.debounce(this.flushNow, opts.wait, {maxWait: opts.maxWait})
  this.ready = false
  this.metadataFeed = new ObjectFeed(this.metadataPath(), key)
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
  var row = {timestamp: Date.now(), ID: uuid(), data: object}
  this.buffer.push(row)
  this.flush()
}

ReplayDB.prototype.flushNow = function () {
  var first = this.buffer[0]
  var last = this.buffer[this.buffer.length - 1]
  var temp = this.buffer
  var tempBuffer = Buffer.from(this.buffer.map(row => JSON.stringify(row)).join('\n'))
  this.buffer = []
  this.feed.append(tempBuffer, (err) => {
    if (err) return this.emit('error', err)

    var newMetadata = this.metadata
    if (!newMetadata.index) newMetadata.index = []
    newMetadata.index.push({block: this.feed.length - 1, startAt: first.timestamp, endAt: last.timestamp})
    this.setMetadata(newMetadata, (err) => {
      if (err) return this.emit('error', err)

      this.emit('flush', temp)
    })
  })
}

// returns the index of the block containing specified time
ReplayDB.prototype.findBlock = function (timestamp) {
  var indices = this.metadata.index
  var b
  for (var i = 0; i < indices.length; i++) {
    console.log(timestamp, indices[i])
    if (indices[i].startAt <= timestamp && indices[i].endAt >= timestamp) {
      b = indices[i].block
      break
    }
  }

  return b
}

ReplayDB.prototype.createReadStream = function (opts) {
  var startBlock
  if (!opts) opts = {}
  if (!opts.startAt) {
    startBlock = 0
  } else {
    for (var i = 0; i < this.metadata.index.length; i++) {
      var idx = this.metadata.index[i]
      if (idx.startAt < opts.startAt) {
        startBlock = idx.block
      } else {
        break
      }
    }
  }

  if (startBlock === undefined) throw new Error('timestamp not found')

  var IDpassed = false
  if (!opts.startFromID) IDpassed = true

  var rs = this.feed.createReadStream({start: startBlock, snapshot: false})
  return rs
    .pipe(ndjson.parse())
    .pipe(through2.obj(function (chunk, enc, cb) {
      if (opts.startFromID && chunk.ID === opts.startFromID) IDpassed = true
      if (IDpassed && (!opts.startAt || chunk.timestamp >= opts.startAt)) this.push(chunk)
      cb()
    }))
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
      ws.send(JSON.stringify(data))
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
