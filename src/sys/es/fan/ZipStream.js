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

  constructor(reader, pos, len, bufferSize, entry) {
    super(null);
    this.#reader = reader;
    this.#pos = pos || 0;
    this.#start = this.#pos;
    this.#max = this.#pos + len;
    this.__bufSize = bufferSize || 1;
    this.__buf = Buffer.allocUnsafe(this.__bufSize);
    this.#entry = entry;
  }

//////////////////////////////////////////////////////////////////////////
// Reading
//////////////////////////////////////////////////////////////////////////

  #reader;
  #start;
  #pos;
  #max;
  #isClosed = false;

  #pre = [];
  __bufPos = 0;
  __availInBuf = 0;
  __bufSize;
  __buf;

  #entry;
  #nextBuf;
  #availInNextBuf = 0;

  __readInto(buf) {
    if (this.#max === Infinity) {
      if (!this.#nextBuf) {
        this.#nextBuf = Buffer.allocUnsafe(this.__bufSize);
        this.#availInNextBuf = this.#reader.read(this.#nextBuf, 0, this.__bufSize, this.#pos);
        this.#pos += this.#availInNextBuf;
      }

      const r1 = this.#availInNextBuf;
      this.#nextBuf.copy(buf, 0, 0, r1);
      this.#availInNextBuf = this.#reader.read(this.#nextBuf, 0, this.__bufSize, this.#pos);

      // scan for data descriptor
      const totalBuf = Buffer.concat([buf.subarray(0, r1), this.#nextBuf.subarray(0, Math.min(23, this.#availInNextBuf))]);
      for(let i = 0; i < totalBuf.length - 23; i++) {
        if (totalBuf.readUInt32LE(i) === 0x08074b50) {
          const compressedNormal = totalBuf.readUInt32LE(i+8);
          const compressed64 = yauzl.readUInt64LE(totalBuf, i+8);
          const compressedActual = this.#pos - r1 + i - this.#start;
          if (compressedActual != compressedNormal && compressedActual != compressed64)
            break;

          // found it!
          this.#max = this.#pos - r1 + i;
          this.#pos = this.#max;
          const useZip64 = compressedActual === compressed64;
          if (this.#entry) {
            // write crc32, sizes into entry
            this.#entry.crc32 = totalBuf.readUInt32LE(i+4);
            if (useZip64) {
              // zip64
              this.#entry.compressedSize = compressed64;
              this.#entry.uncompressedSize = yauzl.readUInt64LE(totalBuf, i+16);
            }
            else {
              this.#entry.compressedSize = compressedNormal;
              this.#entry.uncompressedSize = totalBuf.readUInt32LE(i+12);
            }
            this.#entry.foundDataDescriptor = true;
          }
          this.#reader.unreadBuf(Buffer.concat([buf.subarray(useZip64 ? i+24 : i+16), this.#nextBuf.subarray(0, this.#availInNextBuf)]));
          return r1;
        }
      }

      // no data descriptor in sight
      this.#pos += this.#availInNextBuf;
      return r1;
    }

    const r = this.#reader.read(buf, 0, Math.min(this.__bufSize, this.remaining()), this.#pos);
    this.#pos += r;
    return r;
  }

  __load() {
    if (this.__bufPos >= this.__availInBuf) {
      this.__bufPos = 0;
      this.__availInBuf = this.__readInto(this.__buf);
    }
  }

  read() {
    if (this.#isClosed) throw IOErr.make("Cannot read from closed stream");

    this.__load();
    if (this.avail() == 0) return null;
    if (this.#pre.length > 0) return this.#pre.pop();

    const r = this.__buf.readUInt8(this.__bufPos);
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
    out.close();
    return read == 0 ? null : read;
  }

  unread(n) { 
    this.#pre.push(n); 
    return this;
  }

  skip(n) {
    if (this.#isClosed) throw IOErr.make("Cannot skip in closed stream");
    let skipped = 0;

    if (this.#pre.length > 0) {
      const len = Math.min(this.#pre.length, n);
      this.#pre = this.#pre.slice(0, -len);
      skipped += len;
    }
    if (this.#reader.posMatters && this.#max !== Infinity) {
      const s = Math.min(this.remaining() - skipped, Math.max(0, n - skipped - this.avail()));
      this.#pos += s;
      skipped += s;
    }
    if (skipped == n || this.#pos == this.#max) return skipped;

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

  close() {
    this.#isClosed = true;
  }

//////////////////////////////////////////////////////////////////////////
// Info
//////////////////////////////////////////////////////////////////////////

  avail() {
    return this.#pre.length + (this.__availInBuf - this.__bufPos);
  }

  /** The number of bytes left in the stream. */
  remaining() {
    return this.#max - this.#pos;
  }

}

/*************************************************************************
 * InflateInStream
 ************************************************************************/

class InflateInStream extends ZipInStream {

  constructor(reader, pos, len, bufferSize, entry) {
    super(reader, pos, len, bufferSize, entry);
    this.__bufSize = Math.max(bufferSize || 1, 64);
    this.#rawBuf = Buffer.allocUnsafe(this.__bufSize);
    reader.posMatters = false;
  }

  #rawBuf;
  #rawAvail = 0;

  __load() {
    if (this.__bufPos >= this.__availInBuf) {
      this.__bufPos = 0;
      this.#rawAvail = this.__readInto(this.#rawBuf);
      if (this.#rawAvail == 0) {
        this.__buf = Buffer.allocUnsafe(0);
        this.__availInBuf = 0;
      } else {
        this.__buf = node.zlib.inflateRawSync(
                      this.#rawBuf.subarray(0, this.#rawAvail),
                      { chunkSize: this.__bufSize });
        this.__availInBuf = this.__buf.length;
      }
    }
  }

}

/*************************************************************************
 * ZipOutStream
 ************************************************************************/

/*************************************************************************
 * DeflateOutStream
 ************************************************************************/