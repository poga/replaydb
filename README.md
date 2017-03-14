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

#### `GET /:topic/:offset`

Return the message with given offset in the specified topic.

#### `POST /:topic`

Append a new message (passed by post body) to the topic.

#### `ws://<HOST>/live/:topic/:offset`

Return and listen all messages after the given offset in the specified topic with websocket.

## License

The MIT License