/*
=== unzip-stream ===

Copyright (c) 2017 Michal Hruby
Copyright (c) 2012 - 2013 Near Infinity Corporation

Permission is hereby granted, free of charge, to any person obtaining
a copy of this software and associated documentation files (the
"Software"), to deal in the Software without restriction, including
without limitation the rights to use, copy, modify, merge, publish,
distribute, sublicense, and/or sell copies of the Software, and to
permit persons to whom the Software is furnished to do so, subject to
the following conditions:

The above copyright notice and this permission notice shall be
included in all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND,
EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF
MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND
NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE
LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION
OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION
WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.
*/

class Entry extends node.stream.PassThrough {
  constructor() {
    super();
    this.path = null;
    this.type = null;
    this.isDirectory = false;
  }
  autodrain() {
    return this.pipe(new node.stream.Transform({ transform: function (d, e, cb) { cb(); } }));
  }
}

class MatcherStream extends node.stream.Transform {
  constructor(patternDesc, matchFn) {
    super();

    const p = typeof patternDesc === 'object' ? patternDesc.pattern : patternDesc;

    this.pattern = Buffer.isBuffer(p) ? p : Buffer.from(p);
    this.requiredLength = this.pattern.length;
    if (patternDesc.requiredExtraSize) this.requiredLength += patternDesc.requiredExtraSize;

    this.data = Buffer.from('');
    this.bytesSoFar = 0;

    this.matchFn = matchFn;
  }
  checkDataChunk(ignoreMatchZero) {
    const enoughData = this.data.length >= this.requiredLength; // strict more than ?
    if (!enoughData) { return; }

    const matchIndex = this.data.indexOf(this.pattern, ignoreMatchZero ? 1 : 0);
    if (matchIndex >= 0 && matchIndex + this.requiredLength > this.data.length) {
      if (matchIndex > 0) {
        const packet = this.data.subarray(0, matchIndex);
        this.push(packet);
        this.bytesSoFar += matchIndex;
        this.data = this.data.subarray(matchIndex);
      }
      return;
    }

    if (matchIndex === -1) {
      const packetLen = this.data.length - this.requiredLength + 1;

      const packet = this.data.subarray(0, packetLen);
      this.push(packet);
      this.bytesSoFar += packetLen;
      this.data = this.data.subarray(packetLen);
      return;
    }

    // found match
    if (matchIndex > 0) {
      const packet = this.data.subarray(0, matchIndex);
      this.data = this.data.subarray(matchIndex);
      this.push(packet);
      this.bytesSoFar += matchIndex;
    }

    const finished = this.matchFn ? this.matchFn(this.data, this.bytesSoFar) : true;
    if (finished) {
      this.data = Buffer.from('');
      return;
    }

    return true;
  }
  _transform(chunk, encoding, cb) {
    this.data = Buffer.concat([this.data, chunk]);

    let firstIteration = true;
    while (this.checkDataChunk(!firstIteration)) {
      firstIteration = false;
    }

    cb();
  }
  _flush(cb) {
    if (this.data.length > 0) {
      let firstIteration = true;
      while (this.checkDataChunk(!firstIteration)) {
        firstIteration = false;
      }
    }

    if (this.data.length > 0) {
      this.push(this.data);
      this.data = null;
    }

    cb();
  }
}

const states = {
    STREAM_START:                         0,
    START:                                1,
    LOCAL_FILE_HEADER:                    2,
    LOCAL_FILE_HEADER_SUFFIX:             3,
    FILE_DATA:                            4,
    FILE_DATA_END:                        5,
    DATA_DESCRIPTOR:                      6,
    CENTRAL_DIRECTORY_FILE_HEADER:        7,
    CENTRAL_DIRECTORY_FILE_HEADER_SUFFIX: 8,
    CDIR64_END:                           9,
    CDIR64_END_DATA_SECTOR:               10,
    CDIR64_LOCATOR:                       11,
    CENTRAL_DIRECTORY_END:                12,
    CENTRAL_DIRECTORY_END_COMMENT:        13,
    TRAILING_JUNK:                        14,

    ERROR: 99
}

const FOUR_GIGS = 4294967296;

const SIG_LOCAL_FILE_HEADER  = 0x04034b50;
const SIG_DATA_DESCRIPTOR    = 0x08074b50;
const SIG_CDIR_RECORD        = 0x02014b50;
const SIG_CDIR64_RECORD_END  = 0x06064b50;
const SIG_CDIR64_LOCATOR_END = 0x07064b50;
const SIG_CDIR_RECORD_END    = 0x06054b50;

class UnzipStream extends node.stream.Transform {
  constructor(options) {
    super();

    this.options = options || {};
    this.data = Buffer.from('');
    this.state = states.STREAM_START;
    this.skippedBytes = 0;
    this.parsedEntity = null;
    this.outStreamInfo = {};
  }
  processDataChunk(chunk) {
    let requiredLength;

    switch (this.state) {
      case states.STREAM_START:
      case states.START:
        requiredLength = 4;
        break;
      case states.LOCAL_FILE_HEADER:
        requiredLength = 26;
        break;
      case states.LOCAL_FILE_HEADER_SUFFIX:
        requiredLength = this.parsedEntity.fileNameLength + this.parsedEntity.extraFieldLength;
        break;
      case states.DATA_DESCRIPTOR:
        requiredLength = 12;
        break;
      case states.CENTRAL_DIRECTORY_FILE_HEADER:
        requiredLength = 42;
        break;
      case states.CENTRAL_DIRECTORY_FILE_HEADER_SUFFIX:
        requiredLength = this.parsedEntity.fileNameLength + this.parsedEntity.extraFieldLength + this.parsedEntity.fileCommentLength;
        break;
      case states.CDIR64_END:
        requiredLength = 52;
        break;
      case states.CDIR64_END_DATA_SECTOR:
        requiredLength = this.parsedEntity.centralDirectoryRecordSize - 44;
        break;
      case states.CDIR64_LOCATOR:
        requiredLength = 16;
        break;
      case states.CENTRAL_DIRECTORY_END:
        requiredLength = 18;
        break;
      case states.CENTRAL_DIRECTORY_END_COMMENT:
        requiredLength = this.parsedEntity.commentLength;
        break;
      case states.FILE_DATA:
        return 0;
      case states.FILE_DATA_END:
        return 0;
      case states.TRAILING_JUNK:
        if (this.options.debug) console.log("found", chunk.length, "bytes of TRAILING_JUNK");
        return chunk.length;
      default:
        return chunk.length;
    }

    const chunkLength = chunk.length;
    if (chunkLength < requiredLength) {
      return 0;
    }

    switch (this.state) {
      case states.STREAM_START:
      case states.START:
        const signature = chunk.readUInt32LE(0);
        switch (signature) {
          case SIG_LOCAL_FILE_HEADER:
            this.state = states.LOCAL_FILE_HEADER;
            break;
          case SIG_CDIR_RECORD:
            this.state = states.CENTRAL_DIRECTORY_FILE_HEADER;
            break;
          case SIG_CDIR64_RECORD_END:
            this.state = states.CDIR64_END;
            break;
          case SIG_CDIR64_LOCATOR_END:
            this.state = states.CDIR64_LOCATOR;
            break;
          case SIG_CDIR_RECORD_END:
            this.state = states.CENTRAL_DIRECTORY_END;
            break;
          default:
            const isStreamStart = this.state === states.STREAM_START;
            if (!isStreamStart && (signature & 0xffff) !== 0x4b50 && this.skippedBytes < 26) {
              // we'll allow a padding of max 28 bytes
              let remaining = signature;
              let toSkip = 4;
              for (let i = 1; i < 4 && remaining !== 0; i++) {
                remaining = remaining >>> 8;
                if ((remaining & 0xff) === 0x50) {
                  toSkip = i;
                  break;
                }
              }
              this.skippedBytes += toSkip;
              if (this.options.debug) console.log('Skipped', this.skippedBytes, 'bytes');
              return toSkip;
            }
            this.state = states.ERROR;
            const errMsg = isStreamStart ? "Not a valid zip file" : "Invalid signature in zip file";
            if (this.options.debug) {
              const sig = chunk.readUInt32LE(0);
              let asString;
              try { asString = chunk.slice(0, 4).toString(); } catch (e) { }
              console.log("Unexpected signature in zip file: 0x" + sig.toString(16), '"' + asString + '", skipped', this.skippedBytes, 'bytes');
            }
            this.emit("error", new Error(errMsg));
            return chunk.length;
        }
        this.skippedBytes = 0;
        return requiredLength;

      case states.LOCAL_FILE_HEADER:
        this.parsedEntity = this._readFile(chunk);
        this.state = states.LOCAL_FILE_HEADER_SUFFIX;

        return requiredLength;

      case states.LOCAL_FILE_HEADER_SUFFIX:
      {
        const entry = new Entry();
        const isUtf8 = (this.parsedEntity.flags & 0x800) !== 0;
        entry.path = this._decodeString(chunk.slice(0, this.parsedEntity.fileNameLength), isUtf8);
        const extraDataBuffer = chunk.slice(this.parsedEntity.fileNameLength, this.parsedEntity.fileNameLength + this.parsedEntity.extraFieldLength);
        const extra = this._readExtraFields(extraDataBuffer);
        if (extra && extra.parsed) {
          if (extra.parsed.path && !isUtf8) {
            entry.path = extra.parsed.path;
          }
          if (Number.isFinite(extra.parsed.uncompressedSize) && this.parsedEntity.uncompressedSize === FOUR_GIGS - 1) {
            this.parsedEntity.uncompressedSize = extra.parsed.uncompressedSize;
          }
          if (Number.isFinite(extra.parsed.compressedSize) && this.parsedEntity.compressedSize === FOUR_GIGS - 1) {
            this.parsedEntity.compressedSize = extra.parsed.compressedSize;
          }
        }
        this.parsedEntity.extra = extra.parsed || {};

        if (this.options.debug) {
          const debugObj = Object.assign({}, this.parsedEntity, {
            path: entry.path,
            flags: '0x' + this.parsedEntity.flags.toString(16),
            extraFields: extra && extra.debug
          });
          console.log("decoded LOCAL_FILE_HEADER:", JSON.stringify(debugObj, null, 2));
        }
        this._prepareOutStream(this.parsedEntity, entry);

        this.emit("entry", entry);

        this.state = states.FILE_DATA;

        return requiredLength;
      }

      case states.CENTRAL_DIRECTORY_FILE_HEADER:
        this.parsedEntity = this._readCentralDirectoryEntry(chunk);
        this.state = states.CENTRAL_DIRECTORY_FILE_HEADER_SUFFIX;

        return requiredLength;

      case states.CENTRAL_DIRECTORY_FILE_HEADER_SUFFIX:
      {
        // got file name in chunk[0..]
        const isUtf8 = (this.parsedEntity.flags & 0x800) !== 0;
        let path = this._decodeString(chunk.slice(0, this.parsedEntity.fileNameLength), isUtf8);
        const extraDataBuffer = chunk.slice(this.parsedEntity.fileNameLength, this.parsedEntity.fileNameLength + this.parsedEntity.extraFieldLength);
        const extra = this._readExtraFields(extraDataBuffer);
        if (extra && extra.parsed && extra.parsed.path && !isUtf8) {
          path = extra.parsed.path;
        }
        this.parsedEntity.extra = extra.parsed;

        const isUnix = ((this.parsedEntity.versionMadeBy & 0xff00) >> 8) === 3;
        let unixAttrs, isSymlink;
        if (isUnix) {
          unixAttrs = this.parsedEntity.externalFileAttributes >>> 16;
          const fileType = unixAttrs >>> 12;
          isSymlink = (fileType & 0o12) === 0o12; // __S_IFLNK
        }
        if (this.options.debug) {
          const debugObj = Object.assign({}, this.parsedEntity, {
            path: path,
            flags: '0x' + this.parsedEntity.flags.toString(16),
            unixAttrs: unixAttrs && '0' + unixAttrs.toString(8),
            isSymlink: isSymlink,
            extraFields: extra.debug,
          });
          console.log("decoded CENTRAL_DIRECTORY_FILE_HEADER:", JSON.stringify(debugObj, null, 2));
        }
        this.state = states.START;

        return requiredLength;
      }

      case states.CDIR64_END:
        this.parsedEntity = this._readEndOfCentralDirectory64(chunk);
        if (this.options.debug) {
          console.log("decoded CDIR64_END_RECORD:", this.parsedEntity);
        }
        this.state = states.CDIR64_END_DATA_SECTOR;

        return requiredLength;

      case states.CDIR64_END_DATA_SECTOR:
        this.state = states.START;

        return requiredLength;

      case states.CDIR64_LOCATOR:
        // ignore, nothing interesting
        this.state = states.START;

        return requiredLength;

      case states.CENTRAL_DIRECTORY_END:
        this.parsedEntity = this._readEndOfCentralDirectory(chunk);
        if (this.options.debug) {
          console.log("decoded CENTRAL_DIRECTORY_END:", this.parsedEntity);
        }
        this.state = states.CENTRAL_DIRECTORY_END_COMMENT;

        return requiredLength;

      case states.CENTRAL_DIRECTORY_END_COMMENT:
        if (this.options.debug) {
          console.log("decoded CENTRAL_DIRECTORY_END_COMMENT:", chunk.slice(0, requiredLength).toString());
        }
        this.state = states.TRAILING_JUNK;

        return requiredLength;

      case states.ERROR:
        return chunk.length; // discard

      default:
        console.log("didn't handle state #", this.state, "discarding");
        return chunk.length;
    }
  }
  _prepareOutStream(vars, entry) {
    const self = this;

    const isDirectory = vars.uncompressedSize === 0 && /[\/\\]$/.test(entry.path);
    // protect against malicious zip files which want to extract to parent dirs
    entry.path = entry.path.replace(/^([/\\]*[.]+[/\\]+)*[/\\]*/, "");
    entry.type = isDirectory ? 'Directory' : 'File';
    entry.isDirectory = isDirectory;

    const fileSizeKnown = !(vars.flags & 0x08);
    if (fileSizeKnown) {
      entry.size = vars.uncompressedSize;
    }

    const isVersionSupported = vars.versionsNeededToExtract <= 45;

    this.outStreamInfo = {
      stream: null,
      limit: fileSizeKnown ? vars.compressedSize : -1,
      written: 0
    };

    if (!fileSizeKnown) {
      const pattern = Buffer.allocUnsafe(4);
      pattern.writeUInt32LE(SIG_DATA_DESCRIPTOR, 0);
      const zip64Mode = vars.extra.zip64Mode;
      const extraSize = zip64Mode ? 20 : 12;
      const searchPattern = {
        pattern: pattern,
        requiredExtraSize: extraSize
      };

      const matcherStream = new MatcherStream(searchPattern, function (matchedChunk, sizeSoFar) {
        const vars = self._readDataDescriptor(matchedChunk, zip64Mode);

        let compressedSizeMatches = vars.compressedSize === sizeSoFar;
        // let's also deal with archives with 4GiB+ files without zip64
        if (!zip64Mode && !compressedSizeMatches && sizeSoFar >= FOUR_GIGS) {
          let overflown = sizeSoFar - FOUR_GIGS;
          while (overflown >= 0) {
            compressedSizeMatches = vars.compressedSize === overflown;
            if (compressedSizeMatches) break;
            overflown -= FOUR_GIGS;
          }
        }
        if (!compressedSizeMatches) { return; }

        self.state = states.FILE_DATA_END;
        const sliceOffset = zip64Mode ? 24 : 16;
        if (self.data.length > 0) {
          self.data = Buffer.concat([matchedChunk.slice(sliceOffset), self.data]);
        } else {
          self.data = matchedChunk.slice(sliceOffset);
        }

        return true;
      });
      this.outStreamInfo.stream = matcherStream;
    } else {
      this.outStreamInfo.stream = new stream.PassThrough();
    }

    const isEncrypted = (vars.flags & 0x01) || (vars.flags & 0x40);
    if (isEncrypted || !isVersionSupported) {
      const message = isEncrypted ? "Encrypted files are not supported!"
        : ("Zip version " + Math.floor(vars.versionsNeededToExtract / 10) + "." + vars.versionsNeededToExtract % 10 + " is not supported");

      entry.skip = true;
      setImmediate(() => {
        entry.emit("error", new Error(message));
      });

      // try to skip over this entry
      this.outStreamInfo.stream.pipe(new Entry().autodrain());
      return;
    }

    const isCompressed = vars.compressionMethod > 0;
    if (isCompressed) {
      const inflater = zlib.createInflateRaw();
      inflater.on('error', function (err) {
        self.state = states.ERROR;
        self.emit('error', err);
      });
      this.outStreamInfo.stream.pipe(inflater).pipe(entry);
    } else {
      this.outStreamInfo.stream.pipe(entry);
    }

    if (this._drainAllEntries) {
      entry.autodrain();
    }
  }
  _readFile(data) {
    const vars = binary.parse(data)
      .word16lu('versionsNeededToExtract')
      .word16lu('flags')
      .word16lu('compressionMethod')
      .word16lu('lastModifiedTime')
      .word16lu('lastModifiedDate')
      .word32lu('crc32')
      .word32lu('compressedSize')
      .word32lu('uncompressedSize')
      .word16lu('fileNameLength')
      .word16lu('extraFieldLength')
      .vars;

    return vars;
  }
  _readExtraFields(data) {
    const extra = {};
    const result = { parsed: extra };
    if (this.options.debug) {
      result.debug = [];
    }
    let index = 0;
    while (index < data.length) {
      const vars = binary.parse(data)
        .skip(index)
        .word16lu('extraId')
        .word16lu('extraSize')
        .vars;

      index += 4;

      let fieldType = undefined;
      switch (vars.extraId) {
        case 0x0001:
          fieldType = "Zip64 extended information extra field";
          const z64vars = binary.parse(data.slice(index, index + vars.extraSize))
            .word64lu('uncompressedSize')
            .word64lu('compressedSize')
            .word64lu('offsetToLocalHeader')
            .word32lu('diskStartNumber')
            .vars;
          if (z64vars.uncompressedSize !== null) {
            extra.uncompressedSize = z64vars.uncompressedSize;
          }
          if (z64vars.compressedSize !== null) {
            extra.compressedSize = z64vars.compressedSize;
          }
          extra.zip64Mode = true;
          break;
        case 0x000a:
          fieldType = "NTFS extra field";
          break;
        case 0x5455:
        {
          fieldType = "extended timestamp";
          const timestampFields = data.readUInt8(index);
          let offset = 1;
          if (vars.extraSize >= offset + 4 && timestampFields & 1) {
            extra.mtime = new Date(data.readUInt32LE(index + offset) * 1000);
            offset += 4;
          }
          if (vars.extraSize >= offset + 4 && timestampFields & 2) {
            extra.atime = new Date(data.readUInt32LE(index + offset) * 1000);
            offset += 4;
          }
          if (vars.extraSize >= offset + 4 && timestampFields & 4) {
            extra.ctime = new Date(data.readUInt32LE(index + offset) * 1000);
          }
          break;
        }
        case 0x7075:
          fieldType = "Info-ZIP Unicode Path Extra Field";
          const fieldVer = data.readUInt8(index);
          if (fieldVer === 1) {
            let offset = 1;
            // TODO: should be checking this against our path buffer
            const nameCrc32 = data.readUInt32LE(index + offset);
            offset += 4;
            const pathBuffer = data.slice(index + offset);
            extra.path = pathBuffer.toString();
          }
          break;
        case 0x000d:
        case 0x5855:
        {
          fieldType = vars.extraId === 0x000d ? "PKWARE Unix" : "Info-ZIP UNIX (type 1)";
          let offset = 0;
          if (vars.extraSize >= 8) {
            const atime = new Date(data.readUInt32LE(index + offset) * 1000);
            offset += 4;
            const mtime = new Date(data.readUInt32LE(index + offset) * 1000);
            offset += 4;
            extra.atime = atime;
            extra.mtime = mtime;

            if (vars.extraSize >= 12) {
              const uid = data.readUInt16LE(index + offset);
              offset += 2;
              const gid = data.readUInt16LE(index + offset);
              offset += 2;
              extra.uid = uid;
              extra.gid = gid;
            }
          }
          break;
        }
        case 0x7855:
        {
          fieldType = "Info-ZIP UNIX (type 2)";
          let offset = 0;
          if (vars.extraSize >= 4) {
            const uid = data.readUInt16LE(index + offset);
            offset += 2;
            const gid = data.readUInt16LE(index + offset);
            offset += 2;
            extra.uid = uid;
            extra.gid = gid;
          }
          break;
        }
        case 0x7875:
        {
          fieldType = "Info-ZIP New Unix";
          let offset = 0;
          const extraVer = data.readUInt8(index);
          offset += 1;
          if (extraVer === 1) {
            const uidSize = data.readUInt8(index + offset);
            offset += 1;
            if (uidSize <= 6) {
              extra.uid = data.readUIntLE(index + offset, uidSize);
            }
            offset += uidSize;

            const gidSize = data.readUInt8(index + offset);
            offset += 1;
            if (gidSize <= 6) {
              extra.gid = data.readUIntLE(index + offset, gidSize);
            }
          }
          break;
        }
        case 0x756e:
        {
          fieldType = "ASi Unix";
          let offset = 0;
          if (vars.extraSize >= 14) {
            const crc = data.readUInt32LE(index + offset);
            offset += 4;
            const mode = data.readUInt16LE(index + offset);
            offset += 2;
            const sizdev = data.readUInt32LE(index + offset);
            offset += 4;
            const uid = data.readUInt16LE(index + offset);
            offset += 2;
            const gid = data.readUInt16LE(index + offset);
            offset += 2;
            extra.mode = mode;
            extra.uid = uid;
            extra.gid = gid;
            if (vars.extraSize > 14) {
              const start = index + offset;
              const end = index + vars.extraSize - 14;
              const symlinkName = this._decodeString(data.slice(start, end));
              extra.symlink = symlinkName;
            }
          }
          break;
        }
      }

      if (this.options.debug) {
        result.debug.push({
          extraId: '0x' + vars.extraId.toString(16),
          description: fieldType,
          data: data.slice(index, index + vars.extraSize).inspect()
        });
      }

      index += vars.extraSize;
    }

    return result;
  }
  _readDataDescriptor(data, zip64Mode) {
    if (zip64Mode) {
      const vars = binary.parse(data)
        .word32lu('dataDescriptorSignature')
        .word32lu('crc32')
        .word64lu('compressedSize')
        .word64lu('uncompressedSize')
        .vars;

      return vars;
    }

    const vars = binary.parse(data)
      .word32lu('dataDescriptorSignature')
      .word32lu('crc32')
      .word32lu('compressedSize')
      .word32lu('uncompressedSize')
      .vars;

    return vars;
  }
  _readCentralDirectoryEntry(data) {
    const vars = binary.parse(data)
      .word16lu('versionMadeBy')
      .word16lu('versionsNeededToExtract')
      .word16lu('flags')
      .word16lu('compressionMethod')
      .word16lu('lastModifiedTime')
      .word16lu('lastModifiedDate')
      .word32lu('crc32')
      .word32lu('compressedSize')
      .word32lu('uncompressedSize')
      .word16lu('fileNameLength')
      .word16lu('extraFieldLength')
      .word16lu('fileCommentLength')
      .word16lu('diskNumber')
      .word16lu('internalFileAttributes')
      .word32lu('externalFileAttributes')
      .word32lu('offsetToLocalFileHeader')
      .vars;

    return vars;
  }
  _readEndOfCentralDirectory64(data) {
    const vars = binary.parse(data)
      .word64lu('centralDirectoryRecordSize')
      .word16lu('versionMadeBy')
      .word16lu('versionsNeededToExtract')
      .word32lu('diskNumber')
      .word32lu('diskNumberWithCentralDirectoryStart')
      .word64lu('centralDirectoryEntries')
      .word64lu('totalCentralDirectoryEntries')
      .word64lu('sizeOfCentralDirectory')
      .word64lu('offsetToStartOfCentralDirectory')
      .vars;

    return vars;
  }
  _readEndOfCentralDirectory(data) {
    const vars = binary.parse(data)
      .word16lu('diskNumber')
      .word16lu('diskStart')
      .word16lu('centralDirectoryEntries')
      .word16lu('totalCentralDirectoryEntries')
      .word32lu('sizeOfCentralDirectory')
      .word32lu('offsetToStartOfCentralDirectory')
      .word16lu('commentLength')
      .vars;

    return vars;
  }
  _decodeString(buffer, isUtf8) {
    if (isUtf8) {
      return buffer.toString('utf8');
    }
    // allow passing custom decoder
    if (this.options.decodeString) {
      return this.options.decodeString(buffer);
    }
    let result = "";
    for (let i = 0; i < buffer.length; i++) {
      result += cp437[buffer[i]];
    }
    return result;
  }
  _parseOrOutput(encoding, cb) {
    let consume;
    while ((consume = this.processDataChunk(this.data)) > 0) {
      this.data = this.data.subarray(consume);
      if (this.data.length === 0) break;
    }

    if (this.state === states.FILE_DATA) {
      if (this.outStreamInfo.limit >= 0) {
        const remaining = this.outStreamInfo.limit - this.outStreamInfo.written;
        let packet;
        if (remaining < this.data.length) {
          packet = this.data.subarray(0, remaining);
          this.data = this.data.subarray(remaining);
        } else {
          packet = this.data;
          this.data = Buffer.from('');
        }

        this.outStreamInfo.written += packet.length;
        if (this.outStreamInfo.limit === this.outStreamInfo.written) {
          this.state = states.START;

          this.outStreamInfo.stream.end(packet, encoding, cb);
        } else {
          this.outStreamInfo.stream.write(packet, encoding, cb);
        }
      } else {
        const packet = this.data;
        this.data = Buffer.from('');

        this.outStreamInfo.written += packet.length;
        const outputStream = this.outStreamInfo.stream;
        outputStream.write(packet, encoding, () => {
          if (this.state === states.FILE_DATA_END) {
            this.state = states.START;
            return outputStream.end(cb);
          }
          cb();
        });
      }
      // we've written to the output stream, letting that write deal with the callback
      return;
    }

    cb();
  }
  drainAll() {
    this._drainAllEntries = true;
  }
  _transform(chunk, encoding, cb) {
    const self = this;
    if (self.data.length > 0) {
      self.data = Buffer.concat([self.data, chunk]);
    } else {
      self.data = chunk;
    }

    let startDataLength = self.data.length;
    const done = function () {
      if (self.data.length > 0 && self.data.length < startDataLength) {
        startDataLength = self.data.length;
        self._parseOrOutput(encoding, done);
        return;
      }
      cb();
    };
    self._parseOrOutput(encoding, done);
  }
  _flush(cb) {
    const self = this;
    if (self.data.length > 0) {
      self._parseOrOutput('buffer', function () {
        if (self.data.length > 0) return setImmediate(function () { self._flush(cb); });
        cb();
      });

      return;
    }

    if (self.state === states.FILE_DATA) {
      // uh oh, something went wrong
      return cb(new Error("Stream finished in an invalid state, uncompression failed"));
    }

    setImmediate(cb);
  }
}

const cp437 = '\u0000☺☻♥♦♣♠•◘○◙♂♀♪♫☼►◄↕‼¶§▬↨↑↓→←∟↔▲▼ !"#$%&\'()*+,-./0123456789:;<=>?@ABCDEFGHIJKLMNOPQRSTUVWXYZ[\\]^_`abcdefghijklmnopqrstuvwxyz{|}~⌂ÇüéâäàåçêëèïîìÄÅÉæÆôöòûùÿÖÜ¢£¥₧ƒáíóúñÑªº¿⌐¬½¼¡«»░▒▓│┤╡╢╖╕╣║╗╝╜╛┐└┴┬├─┼╞╟╚╔╩╦╠═╬╧╨╤╥╙╘╒╓╫╪┘┌█▄▌▐▀αßΓπΣσµτΦΘΩδ∞φε∩≡±≥≤⌠⌡÷≈°∙·√ⁿ²■ ';

class ParserStream extends node.stream.Transform {
  constructor(opts) {
    super({ readableObjectMode: true });

    this.opts = opts || {};
    this.unzipStream = new UnzipStream(this.opts);

    const self = this;
    this.unzipStream.on('entry', function (entry) {
      self.push(entry);
    });
    this.unzipStream.on('error', function (error) {
      self.emit('error', error);
    });
  }
  _transform(chunk, encoding, cb) {
    this.unzipStream.write(chunk, encoding, cb);
  }
  _flush(cb) {
    const self = this;
    this.unzipStream.end(function () {
      process.nextTick(function () { self.emit('close'); });
      cb();
    });
  }
  on(eventName, fn) {
    if (eventName === 'entry') {
      return Transform.prototype.on.call(this, 'data', fn);
    }
    return Transform.prototype.on.call(this, eventName, fn);
  }
  drainAll() {
    this.unzipStream.drainAll();
    return this.pipe(new Transform({ objectMode: true, transform: function (d, e, cb) { cb(); } }));
  }
}
