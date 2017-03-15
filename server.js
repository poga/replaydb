const express = require('express')
const bodyParser = require('body-parser')
const kafka = require('hyperkafka')
const uint64be = require('uint64be')

function server (archive) {
  var app = express()
  require('express-ws')(app)

  app.use(bodyParser.json())

  const consumer = kafka.Consumer(archive)
  const producer = kafka.Producer(archive)
  producer.on('flush', (size, topic) => {
    console.log('flushed', topic, size)
  })

  app.get('/:topic/:offset', function (req, res, next) {
    consumer.get(req.params.topic, req.params.offset, (err, message) => {
      if (err) return next(err)

      res.json(debuffer(message))
    })
  })

  app.ws('/live/:topic/:offset', function (ws, req) {
    var rs = consumer.createReadStream(req.params.topic, req.params.offset)
    var disconnected = false
    ws.on('close', function () { rs.destroy() })
    rs.on('data', msg => {
      if (disconnected) return

      try {
        ws.send(JSON.stringify(debuffer(msg)))
      } catch (e) {
        disconnected = true
        rs.destroy()
      }
    })
  })

  app.post('/:topic', function (req, res) {
    producer.write(req.params.topic, req.body)
    res.json({status: 'ok'})
  })

  // catch all error handler
  app.use(function (err, req, res, next) {
    console.error(err.stack)
    res.status(500).send('Something went wrong')
  })

  return app
}

module.exports = server

function debuffer (msg) {
  return {offset: msg.offset, payload: msg.payload.toString(), timestamp: uint64be.decode(msg.timestamp)}
}
