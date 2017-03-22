const hypercore = require('hypercore')
const _ = require('lodash')
const express = require('express')
const bodyParser = require('body-parser')
const events = require('events')
const inherits = require('inherits')

function ReplayDB (path) {
  if (!(this instanceof ReplayDB)) return new ReplayDB(path)
  events.EventEmitter.call(this)

  this.path = path
  this.feed = hypercore(path)
  this.buffer = new Buffer(0)
  this.flush = _.debounce(this.flushNow, 1000, {maxWait: 5000})
  this.ready = false
}

inherits(ReplayDB, events.EventEmitter)

ReplayDB.prototype.open = function (cb) {
  this.feed.on('ready', () => {
    this.ready = true
    cb()
  })
}

ReplayDB.prototype.append = function (object) {
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

module.exports = ReplayDB
