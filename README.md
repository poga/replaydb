# ReplayDB

![stability-experimental](https://img.shields.io/badge/stability-experimental-orange.svg?style=flat-square)
[![NPM Version](https://img.shields.io/npm/v/replaydb.svg?style=flat-square)](https://www.npmjs.com/package/replaydb)
[![JavaScript Style Guide](https://img.shields.io/badge/code%20style-standard-brightgreen.svg?style=flat-square)](http://standardjs.com/)

A decentralized database with HTTP and WebSocket interface, based on [hyperkafka](https://github.com/poga/hyperkafka).

`npm i -g replaydb`

## Usage

```bash
$ replaydb path [key] [--port=8080]
```

## Interface

#### `POST /`

Append a new message (passed by post body).

#### `ws://<HOST>/ws`

Return and listen all new messages with websocket.

## License

The MIT License