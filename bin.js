const hyperdrive = require('hyperdrive')
const level = require('level')
const argv = require('minimist')(process.argv.slice(2))
const ReplayDB = require('.')
const fs = require('fs')
const mkdirp = require('mkdirp')
const path = require('path')
const raf = require('random-access-file')

const dbPath = argv._[0]
const key = argv._[1]

if (!dbPath) throw new Error('path is required')

try {
  if (!fs.statSync(dbPath).isDirectory()) throw new Error('path is not a dir')
  if (!key) {
    console.log('key is required if dir exist')
  } else {
    // path exists, open existing archive in the path
    var archive = createArchive(dbPath, key)
    console.log('archive opened', archive.key.toString('hex'))
    run(archive)
  }
} catch (e) {
  mkdirp(dbPath, err => {
    if (err) throw err

    var archive = createArchive(dbPath, key)
    console.log('new archive created', archive.key.toString('hex'))
    run(archive)
  })
}

function run (archive) {
  archive.open(() => {
    var db = new ReplayDB(archive)
    var port = argv.port || 8080
    db.listen(port, () => {
      console.log('listening at', port)
    })
  })
}

function createArchive (dir, key) {
  console.log('creating', path.join(dir, '.replaydb'))
  var drive = hyperdrive(level(path.join(dir, '.replaydb')))
  return drive.createArchive(key, {
    file: name => raf(path.join(dir, name))
  })
}
