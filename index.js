const server = require('./server')

function ReplayDB (archive) {
  if (!(this instanceof ReplayDB)) return new ReplayDB(archive)
  this.server = server(archive)
}

ReplayDB.prototype.listen = function (port, cb) {
  this.app = this.server.listen(port, cb)
}

ReplayDB.prototype.close = function (cb) {
  if (!this.app) return cb(new Error('nothing to close'))

  this.app.close(cb)
}

module.exports = ReplayDB
