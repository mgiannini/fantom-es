/*
*** fd-slicer ***

Copyright (c) 2014 Andrew Kelley

Permission is hereby granted, free of charge, to any person
obtaining a copy of this software and associated documentation files
(the "Software"), to deal in the Software without restriction,
including without limitation the rights to use, copy, modify, merge,
publish, distribute, sublicense, and/or sell copies of the Software,
and to permit persons to whom the Software is furnished to do so,
subject to the following conditions:

The above copyright notice and this permission notice shall be
included in all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND,
EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF
MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND
NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS
BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN
ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN
CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
*/

import { read, write, close } from 'fs';
import { Readable, Writable, PassThrough } from 'stream';
import Pend from './pend.js';
import { EventEmitter } from 'events';

export { createFromBuffer, createFromBuffer, createFromFd, BufferSlicer, FdSlicer };

class FdSlicer extends EventEmitter {
  constructor(fd, options) {
    options = options || {};
    EventEmitter.call(this);

    this.fd = fd;
    this.pend = new Pend();
    this.pend.max = 1;
    this.refCount = 0;
    this.autoClose = !!options.autoClose;
  }
  read(buffer, offset, length, position, callback) {
    var self = this;
    self.pend.go(function (cb) {
      read(self.fd, buffer, offset, length, position, function (err, bytesRead, buffer) {
        cb();
        callback(err, bytesRead, buffer);
      });
    });
  }
  write(buffer, offset, length, position, callback) {
    var self = this;
    self.pend.go(function (cb) {
      write(self.fd, buffer, offset, length, position, function (err, written, buffer) {
        cb();
        callback(err, written, buffer);
      });
    });
  }
  createReadStream(options) {
    return new ReadStream(this, options);
  }
  createWriteStream(options) {
    return new WriteStream(this, options);
  }
  ref() {
    this.refCount += 1;
  }
  unref() {
    var self = this;
    self.refCount -= 1;

    if (self.refCount > 0) return;
    if (self.refCount < 0) throw new Error("invalid unref");

    if (self.autoClose) {
      close(self.fd, onCloseDone);
    }

    function onCloseDone(err) {
      if (err) {
        self.emit('error', err);
      } else {
        self.emit('close');
      }
    }
  }
}

class ReadStream extends Readable {
  constructor(context, options) {
    options = options || {};
    Readable.call(this, options);

    this.context = context;
    this.context.ref();

    this.start = options.start || 0;
    this.endOffset = options.end;
    this.pos = this.start;
    this.destroyed = false;
  }
  _read(n) {
    var self = this;
    if (self.destroyed) return;

    var toRead = Math.min(self._readableState.highWaterMark, n);
    if (self.endOffset != null) {
      toRead = Math.min(toRead, self.endOffset - self.pos);
    }
    if (toRead <= 0) {
      self.destroyed = true;
      self.push(null);
      self.context.unref();
      return;
    }
    self.context.pend.go(function (cb) {
      if (self.destroyed) return cb();
      var buffer = new Buffer(toRead);
      read(self.context.fd, buffer, 0, toRead, self.pos, function (err, bytesRead) {
        if (err) {
          self.destroy(err);
        } else if (bytesRead === 0) {
          self.destroyed = true;
          self.push(null);
          self.context.unref();
        } else {
          self.pos += bytesRead;
          self.push(buffer.slice(0, bytesRead));
        }
        cb();
      });
    });
  }
  destroy(err) {
    if (this.destroyed) return;
    err = err || new Error("stream destroyed");
    this.destroyed = true;
    this.emit('error', err);
    this.context.unref();
  }
}

class WriteStream extends Writable {
  constructor(context, options) {
    options = options || {};
    Writable.call(this, options);

    this.context = context;
    this.context.ref();

    this.start = options.start || 0;
    this.endOffset = (options.end == null) ? Infinity : +options.end;
    this.bytesWritten = 0;
    this.pos = this.start;
    this.destroyed = false;

    this.on('finish', this.destroy.bind(this));
  }
  _write(buffer, encoding, callback) {
    var self = this;
    if (self.destroyed) return;

    if (self.pos + buffer.length > self.endOffset) {
      var err = new Error("maximum file length exceeded");
      err.code = 'ETOOBIG';
      self.destroy();
      callback(err);
      return;
    }
    self.context.pend.go(function (cb) {
      if (self.destroyed) return cb();
      write(self.context.fd, buffer, 0, buffer.length, self.pos, function (err, bytes) {
        if (err) {
          self.destroy();
          cb();
          callback(err);
        } else {
          self.bytesWritten += bytes;
          self.pos += bytes;
          self.emit('progress');
          cb();
          callback();
        }
      });
    });
  }
  destroy() {
    if (this.destroyed) return;
    this.destroyed = true;
    this.context.unref();
  }
}

class BufferSlicer extends EventEmitter {
  constructor(buffer, options) {
    EventEmitter.call(this);

    options = options || {};
    this.refCount = 0;
    this.buffer = buffer;
    this.maxChunkSize = options.maxChunkSize || Number.MAX_SAFE_INTEGER;
  }
  read(buffer, offset, length, position, callback) {
    var end = position + length;
    var delta = end - this.buffer.length;
    var written = (delta > 0) ? delta : length;
    this.buffer.copy(buffer, offset, position, end);
    setImmediate(function () {
      callback(null, written);
    });
  }
  write(buffer, offset, length, position, callback) {
    buffer.copy(this.buffer, position, offset, offset + length);
    setImmediate(function () {
      callback(null, length, buffer);
    });
  }
  createReadStream(options) {
    options = options || {};
    var readStream = new PassThrough(options);
    readStream.destroyed = false;
    readStream.start = options.start || 0;
    readStream.endOffset = options.end;
    // by the time this function returns, we'll be done.
    readStream.pos = readStream.endOffset || this.buffer.length;

    // respect the maxChunkSize option to slice up the chunk into smaller pieces.
    var entireSlice = this.buffer.slice(readStream.start, readStream.pos);
    var offset = 0;
    while (true) {
      var nextOffset = offset + this.maxChunkSize;
      if (nextOffset >= entireSlice.length) {
        // last chunk
        if (offset < entireSlice.length) {
          readStream.write(entireSlice.slice(offset, entireSlice.length));
        }
        break;
      }
      readStream.write(entireSlice.slice(offset, nextOffset));
      offset = nextOffset;
    }

    readStream.end();
    readStream.destroy = function () {
      readStream.destroyed = true;
    };
    return readStream;
  }
  createWriteStream(options) {
    var bufferSlicer = this;
    options = options || {};
    var writeStream = new Writable(options);
    writeStream.start = options.start || 0;
    writeStream.endOffset = (options.end == null) ? this.buffer.length : +options.end;
    writeStream.bytesWritten = 0;
    writeStream.pos = writeStream.start;
    writeStream.destroyed = false;
    writeStream._write = function (buffer, encoding, callback) {
      if (writeStream.destroyed) return;

      var end = writeStream.pos + buffer.length;
      if (end > writeStream.endOffset) {
        var err = new Error("maximum file length exceeded");
        err.code = 'ETOOBIG';
        writeStream.destroyed = true;
        callback(err);
        return;
      }
      buffer.copy(bufferSlicer.buffer, writeStream.pos, 0, buffer.length);

      writeStream.bytesWritten += buffer.length;
      writeStream.pos = end;
      writeStream.emit('progress');
      callback();
    };
    writeStream.destroy = function () {
      writeStream.destroyed = true;
    };
    return writeStream;
  }
  ref() {
    this.refCount += 1;
  }
  unref() {
    this.refCount -= 1;

    if (this.refCount < 0) {
      throw new Error("invalid unref");
    }
  }
}

function createFromBuffer(buffer, options) {
  return new BufferSlicer(buffer, options);
}

function createFromFd(fd, options) {
  return new FdSlicer(fd, options);
}