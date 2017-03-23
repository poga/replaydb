const argv = require('minimist')(process.argv.slice(2))
const ReplayDB = require('.')
const mkdirp = require('mkdirp')
const swarm = require('hyperdiscovery')
const express = require('express')
const expressWs = require('express-ws')

const dbPath = argv._[0]

if (!dbPath) throw new Error('path is required')

mkdirp(dbPath, function (err) {
  if (err) throw err
  var db = new ReplayDB(dbPath)
  var port = argv.port || 8080
  db.open(function () {
    console.log('key', db.feed.key.toString('hex'))
    swarm(db.feed, {live: true})
    var app = express()
    expressWs(app)
    app.use('/lass', db.routes())
    app.listen(port, () => {
      console.log('listening at', port)
    })
    db.feed.on('upload', (i, d) => { console.log('uploaded', i, d.length) })
  })
})
