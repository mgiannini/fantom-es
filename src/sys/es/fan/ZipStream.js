//
// Copyright (c) 2023, Brian Frank and Andy Frank
// Licensed under the Academic Free License version 3.0
//
// History:
//   29 Jul 2023  Kiera O'Flynn  Creation
//

/*************************************************************************
 * ZipInStream
 ************************************************************************/

// Reads from a Yauzl reader.
class ZipInStream extends InStream {

//////////////////////////////////////////////////////////////////////////
// Construction
//////////////////////////////////////////////////////////////////////////

  constructor(reader, pos, len, bufferSize) {
    super(null);
    this.#reader = reader;
    this.#pos = pos || 0;
    this.#max = this.#pos + len;
    this.__bufSize = bufferSize || 1;
    this.__buf = Buffer.allocUnsafe(this.__bufSize);
  }

//////////////////////////////////////////////////////////////////////////
// Reading
//////////////////////////////////////////////////////////////////////////

  #reader;
  #pos;
  #max;

  #pre = [];
  __bufPos = 0;
  __avail = 0;
  __bufSize;
  __buf;

  __readInto(buf) {
    const r = this.#reader.read(buf, 0, Math.min(this.__bufSize, this.#max - this.#pos), this.#pos);
    this.#pos += r;
    return r;
  }

  __load() {
    if (this.__bufPos >= this.__avail) {
      this.__bufPos = 0;
      this.__avail = this.__readInto(this.__buf);
    }
  }

  read() {
    this.__load();
    if (this.avail() == 0) return null;
    if (this.#pre.length > 0) return this.#pre.pop();

    const r = this.__buf.readUInt32LE(this.__bufPos);
    this.__bufPos++;
    return r;
  }

  readBuf(buf, n) {
    const out = buf.out();
    let read = 0;
    let r;
    while (n > 0) {
      r = this.read();
      if (r === null) break;
      out.write(r);
      n--;
      read++;
    }
    return read == 0 ? null : read;
  }

  unread(n) { 
    this.#pre.push(n); 
    return this;
  }

  skip(n) {
    let skipped = 0;

    if (this.#pre.length > 0) {
      const len = Math.min(this.#pre.length, n);
      this.#pre = this.#pre.slice(0, -len);
      skipped += len;
    }
    if (this.#reader.posMatters) {
      const s = Math.max(0, n - skipped - this.avail());
      this.#pos += s;
      skipped += s;
    }
    if (skipped == n) return skipped;

    if (this.avail() === 0) this.__load();

    while (true) {
      const a = this.avail();
      if (a === 0 || skipped == n) break;
      const rem = n - skipped;
      if (rem < a) {
        skipped += rem;
        this.__bufPos += rem;
        break;
      }
      skipped += a;
      this.__load();
    }
    return skipped;
  }

  avail() {
    return this.#pre.length + (this.__avail - this.__bufPos);
  }

}

/*************************************************************************
 * InflateInStream
 ************************************************************************/

class InflateInStream extends ZipInStream {

  constructor(reader, pos, len, bufferSize) {
    super(reader, pos, len, bufferSize);
    this.__bufSize = Math.max(bufferSize || 1, 64);
    this.#rawBuf = Buffer.allocUnsafe(this.__bufSize);
    reader.posMatters = false;
  }

  #rawBuf;
  #rawAvail = 0;

  __load() {
    if (this.__bufPos >= this.__avail) {
      this.__bufPos = 0;
      this.#rawAvail = this.__readInto(this.#rawBuf);
      this.__buf = node.zlib.inflateRawSync(
                    this.#rawBuf.subarray(0, this.#rawAvail),
                    { chunkSize: this.__bufSize });
      this.__avail = this.__buf.length;
    }
  }

}