const hyperdrive = require('hyperdrive')
const level = require('level')
const argv = require('minimist')(process.argv.slice(2))
const ReplayDB = require('.')

const dbPath = argv._[0]
const key = argv._[1]

var drive = hyperdrive(level(dbPath))
var archive = drive.createArchive(key)
console.log('key', archive.key.toString('hex'))

var db = new ReplayDB(archive)
var port = argv.port || 8080
db.listen(port, () => {
  console.log('listening at', port)
})
