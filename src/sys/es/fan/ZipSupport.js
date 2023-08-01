/*
=== yauzl ===

The MIT License (MIT)

Copyright (c) 2014 Josh Wolfe

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
*/

class yauzl {

  static open(path, options) {
    if (options == null) options = {};
    if (options.autoClose == null) options.autoClose = true;
    if (options.decodeStrings == null) options.decodeStrings = true;
    if (options.validateEntrySizes == null) options.validateEntrySizes = true;
    if (options.strictFileNames == null) options.strictFileNames = false;

    const fd = node.fs.openSync(path, "r");

    try {
      return yauzl.fromFd(fd, options);
    } catch (e) {
      node.fs.closeSync(fd);
      throw e;
    }
  }

  static fromFd(fd, options) {
    if (options == null) options = {};
    if (options.autoClose == null) options.autoClose = false;
    if (options.decodeStrings == null) options.decodeStrings = true;
    if (options.validateEntrySizes == null) options.validateEntrySizes = true;
    if (options.strictFileNames == null) options.strictFileNames = false;

    const stats = node.fs.fstatSync(fd);
    const reader = new YauzlFileReader(fd);
    return yauzl.fromRandomAccessReader(reader, stats.size, options);
  }

  static fromRandomAccessReader(reader, totalSize, options) {
    if (options == null) options = {};
    if (options.autoClose == null) options.autoClose = true;
    if (options.decodeStrings == null) options.decodeStrings = true;
    const decodeStrings = !!options.decodeStrings;
    if (options.validateEntrySizes == null) options.validateEntrySizes = true;
    if (options.strictFileNames == null) options.strictFileNames = false;
    if (typeof totalSize !== "number")
      throw new Error("expected totalSize parameter to be a number");
    if (totalSize > Number.MAX_SAFE_INTEGER)
      throw new Error("zip file too large. only file sizes up to 2^52 are supported due to JavaScript's Number type being an IEEE 754 double.");

    // eocdr means End of Central Directory Record.
    // search backwards for the eocdr signature.
    // the last field of the eocdr is a variable-length comment.
    // the comment size is encoded in a 2-byte field in the eocdr, which we can't find without trudging backwards through the comment to find it.
    // as a consequence of this design decision, it's possible to have ambiguous zip file metadata if a coherent eocdr was in the comment.
    // we search backwards for a eocdr signature, and hope that whoever made the zip file was smart enough to forbid the eocdr signature in the comment.
    const eocdrWithoutCommentSize = 22;
    const maxCommentSize = 0xffff; // 2-byte size
    const bufferSize = Math.min(eocdrWithoutCommentSize + maxCommentSize, totalSize);
    const buffer = Buffer.allocUnsafe(bufferSize);
    const bufferReadStart = totalSize - buffer.length;
    yauzl.readAndAssertNoEof(reader, buffer, 0, bufferSize, bufferReadStart);

    for (let i = bufferSize - eocdrWithoutCommentSize; i >= 0; i -= 1) {
      if (buffer.readUInt32LE(i) !== 0x06054b50) continue;
      // found eocdr
      const eocdrBuffer = buffer.subarray(i);

      // 0 - End of central directory signature = 0x06054b50
      // 4 - Number of this disk
      const diskNumber = eocdrBuffer.readUInt16LE(4);
      if (diskNumber !== 0)
        throw new Error("multi-disk zip files are not supported: found disk number: " + diskNumber);

      // 6 - Disk where central directory starts
      // 8 - Number of central directory records on this disk
      // 10 - Total number of central directory records
      let entryCount = eocdrBuffer.readUInt16LE(10);
      // 12 - Size of central directory (bytes)
      // 16 - Offset of start of central directory, relative to start of archive
      let centralDirectoryOffset = eocdrBuffer.readUInt32LE(16);
      // 20 - Comment length
      const commentLength = eocdrBuffer.readUInt16LE(20);
      const expectedCommentLength = eocdrBuffer.length - eocdrWithoutCommentSize;
      if (commentLength !== expectedCommentLength)
        throw new Error("invalid comment length. expected: " + expectedCommentLength + ". found: " + commentLength);

      // 22 - Comment
      // the encoding is always cp437.
      const comment = decodeStrings ? yauzl.decodeBuffer(eocdrBuffer, 22, eocdrBuffer.length, false)
                                  : eocdrBuffer.subarray(22);

      if (!(entryCount === 0xffff || centralDirectoryOffset === 0xffffffff))
        return new YauzlZipFile(reader, centralDirectoryOffset, totalSize, entryCount, comment, options.autoClose, decodeStrings, options.validateEntrySizes, options.strictFileNames);

      // ZIP64 format

      // ZIP64 Zip64 end of central directory locator
      const zip64EocdlBuffer = Buffer.allocUnsafe(20);
      const zip64EocdlOffset = bufferReadStart + i - zip64EocdlBuffer.length;
      yauzl.readAndAssertNoEof(reader, zip64EocdlBuffer, 0, zip64EocdlBuffer.length, zip64EocdlOffset);

      // 0 - zip64 end of central dir locator signature = 0x07064b50
      if (zip64EocdlBuffer.readUInt32LE(0) !== 0x07064b50)
        throw new Error("invalid zip64 end of central directory locator signature");

      // 4 - number of the disk with the start of the zip64 end of central directory
      // 8 - relative offset of the zip64 end of central directory record
      const zip64EocdrOffset = yauzl.readUInt64LE(zip64EocdlBuffer, 8);
      // 16 - total number of disks

      // ZIP64 end of central directory record
      const zip64EocdrBuffer = Buffer.allocUnsafe(56);
      yauzl.readAndAssertNoEof(reader, zip64EocdrBuffer, 0, zip64EocdrBuffer.length, zip64EocdrOffset);

      // 0 - zip64 end of central dir signature                           4 bytes  (0x06064b50)
      if (zip64EocdrBuffer.readUInt32LE(0) !== 0x06064b50)
        throw new Error("invalid zip64 end of central directory record signature");

      // 4 - size of zip64 end of central directory record                8 bytes
      // 12 - version made by                                             2 bytes
      // 14 - version needed to extract                                   2 bytes
      // 16 - number of this disk                                         4 bytes
      // 20 - number of the disk with the start of the central directory  4 bytes
      // 24 - total number of entries in the central directory on this disk         8 bytes
      // 32 - total number of entries in the central directory            8 bytes
      entryCount = yauzl.readUInt64LE(zip64EocdrBuffer, 32);
      // 40 - size of the central directory                               8 bytes
      // 48 - offset of start of central directory with respect to the starting disk number     8 bytes
      centralDirectoryOffset = yauzl.readUInt64LE(zip64EocdrBuffer, 48);
      // 56 - zip64 extensible data sector                                (variable size)
      return new YauzlZipFile(reader, centralDirectoryOffset, totalSize, entryCount, comment, options.autoClose, decodeStrings, options.validateEntrySizes, options.strictFileNames);
    }
    throw new Error("end of central directory record signature not found");
  }

  static readAndAssertNoEof(reader, buffer, offset, length, position, errCallback, self) {
    if (length === 0) return;

    const bytesRead = reader.read(buffer, offset, length, position);
    if (bytesRead < length) {
      const e = new Error("unexpected EOF");
      if (errCallback) errCallback.call(self, e);
      else throw e;
    }
  }

  static readUInt64LE(buffer, offset) {
    // there is no native function for this, because we can't actually store 64-bit integers precisely.
    // after 53 bits, JavaScript's Number type (IEEE 754 double) can't store individual integers anymore.
    // but since 53 bits is a whole lot more than 32 bits, we do our best anyway.
    const lower32 = buffer.readUInt32LE(offset);
    const upper32 = buffer.readUInt32LE(offset + 4);
    // we can't use bitshifting here, because JavaScript bitshifting only works on 32-bit integers.
    return upper32 * 0x100000000 + lower32;
    // as long as we're bounds checking the result of this function against the total file size,
    // we'll catch any overflow errors, because we already made sure the total file size was within reason.
  }

  static #cp437 = '\u0000☺☻♥♦♣♠•◘○◙♂♀♪♫☼►◄↕‼¶§▬↨↑↓→←∟↔▲▼ !"#$%&\'()*+,-./0123456789:;<=>?@ABCDEFGHIJKLMNOPQRSTUVWXYZ[\\]^_`abcdefghijklmnopqrstuvwxyz{|}~⌂ÇüéâäàåçêëèïîìÄÅÉæÆôöòûùÿÖÜ¢£¥₧ƒáíóúñÑªº¿⌐¬½¼¡«»░▒▓│┤╡╢╖╕╣║╗╝╜╛┐└┴┬├─┼╞╟╚╔╩╦╠═╬╧╨╤╥╙╘╒╓╫╪┘┌█▄▌▐▀αßΓπΣσµτΦΘΩδ∞φε∩≡±≥≤⌠⌡÷≈°∙·√ⁿ²■ ';
  static decodeBuffer(buffer, start, end, isUtf8) {
    if (isUtf8) {
      return buffer.toString("utf8", start, end);
    } else {
      let result = "";
      for (let i = start; i < end; i++) {
        result += yauzl.#cp437[buffer[i]];
      }
      return result;
    }
  }

  static dosDateTimeToFantom(date, time) {
    const day = date & 0x1f; // 1-31
    const month = (date >> 5 & 0xf) - 1; // 1-12, 0-11
    const year = (date >> 9 & 0x7f) + 1980; // 0-128, 1980-2108
  
    const second = (time & 0x1f) * 2; // 0-29, 0-58 (even numbers)
    const minute = time >> 5 & 0x3f; // 0-59
    const hour = time >> 11 & 0x1f; // 0-23
  
    return DateTime.make(year, month, day, hour, minute, second);
  }
}

class YauzlZipFile {
  constructor(reader, centralDirectoryOffset, fileSize, entryCount, comment, autoClose, decodeStrings, validateEntrySizes, strictFileNames) {
    this.reader = reader;
    this.readEntryCursor = centralDirectoryOffset;
    this.fileSize = fileSize;
    this.entryCount = entryCount;
    this.comment = comment;
    this.entriesRead = 0;
    this.autoClose = !!autoClose;
    this.decodeStrings = !!decodeStrings;
    this.validateEntrySizes = !!validateEntrySizes;
    this.strictFileNames = !!strictFileNames;
    this.isOpen = true;
  }

  close() {
    if (!this.isOpen) return;
    this.isOpen = false;
    this.reader.close();
  }
  getEntry() {
    const self = this;
    if (this.entryCount === this.entriesRead) {
      // done with metadata
      return;
    }

    let buffer = Buffer.allocUnsafe(46);
    yauzl.readAndAssertNoEof(this.reader, buffer, 0, buffer.length, this.readEntryCursor, this.throwErrorAndAutoClose, self);

    const entry = new YauzlEntry();
    // 0 - Central directory file header signature
    const signature = buffer.readUInt32LE(0);
    if (signature !== 0x02014b50) return this.throwErrorAndAutoClose(new Error("invalid central directory file header signature: 0x" + signature.toString(16)));
    // 4 - Version made by
    entry.versionMadeBy = buffer.readUInt16LE(4);
    // 6 - Version needed to extract (minimum)
    entry.versionNeededToExtract = buffer.readUInt16LE(6);
    // 8 - General purpose bit flag
    entry.generalPurposeBitFlag = buffer.readUInt16LE(8);
    // 10 - Compression method
    entry.compressionMethod = buffer.readUInt16LE(10);
    // 12 - File last modification time
    entry.lastModFileTime = buffer.readUInt16LE(12);
    // 14 - File last modification date
    entry.lastModFileDate = buffer.readUInt16LE(14);
    // 16 - CRC-32
    entry.crc32 = buffer.readUInt32LE(16);
    // 20 - Compressed size
    entry.compressedSize = buffer.readUInt32LE(20);
    // 24 - Uncompressed size
    entry.uncompressedSize = buffer.readUInt32LE(24);
    // 28 - File name length (n)
    entry.fileNameLength = buffer.readUInt16LE(28);
    // 30 - Extra field length (m)
    entry.extraFieldLength = buffer.readUInt16LE(30);
    // 32 - File comment length (k)
    entry.fileCommentLength = buffer.readUInt16LE(32);
    // 34 - Disk number where file starts
    // 36 - Internal file attributes
    entry.internalFileAttributes = buffer.readUInt16LE(36);
    // 38 - External file attributes
    entry.externalFileAttributes = buffer.readUInt32LE(38);
    // 42 - Relative offset of local file header
    entry.relativeOffsetOfLocalHeader = buffer.readUInt32LE(42);

    if (entry.generalPurposeBitFlag & 0x40) return this.throwErrorAndAutoClose(new Error("strong encryption is not supported"));

    this.readEntryCursor += 46;

    buffer = Buffer.allocUnsafe(entry.fileNameLength + entry.extraFieldLength + entry.fileCommentLength);
    yauzl.readAndAssertNoEof(this.reader, buffer, 0, buffer.length, this.readEntryCursor, this.throwErrorAndAutoClose, self);

    // 46 - File name
    const isUtf8 = (entry.generalPurposeBitFlag & 0x800) !== 0;
    entry.fileName = this.decodeStrings ? yauzl.decodeBuffer(buffer, 0, entry.fileNameLength, isUtf8)
      : buffer.subarray(0, entry.fileNameLength);

    // 46+n - Extra field
    const fileCommentStart = entry.fileNameLength + entry.extraFieldLength;
    const extraFieldBuffer = buffer.subarray(entry.fileNameLength, fileCommentStart);
    entry.extraFields = [];
    let i = 0;
    while (i < extraFieldBuffer.length - 3) {
      const headerId = extraFieldBuffer.readUInt16LE(i + 0);
      const dataSize = extraFieldBuffer.readUInt16LE(i + 2);
      const dataStart = i + 4;
      const dataEnd = dataStart + dataSize;
      if (dataEnd > extraFieldBuffer.length) return this.throwErrorAndAutoClose(new Error("extra field length exceeds extra field buffer size"));
      const dataBuffer = Buffer.allocUnsafe(dataSize);
      extraFieldBuffer.copy(dataBuffer, 0, dataStart, dataEnd);
      entry.extraFields.push({
        id: headerId,
        data: dataBuffer,
      });
      i = dataEnd;
    }

    // 46+n+m - File comment
    entry.fileComment = this.decodeStrings ? yauzl.decodeBuffer(buffer, fileCommentStart, fileCommentStart + entry.fileCommentLength, isUtf8)
      : buffer.subarray(fileCommentStart, fileCommentStart + entry.fileCommentLength);
    // compatibility hack for https://github.com/thejoshwolfe/yauzl/issues/47
    entry.comment = entry.fileComment;

    this.readEntryCursor += buffer.length;
    this.entriesRead += 1;

    if (entry.uncompressedSize === 0xffffffff ||
      entry.compressedSize === 0xffffffff ||
      entry.relativeOffsetOfLocalHeader === 0xffffffff) {
      // ZIP64 format
      // find the Zip64 Extended Information Extra Field
      let zip64EiefBuffer = null;
      for (i = 0; i < entry.extraFields.length; i++) {
        const extraField = entry.extraFields[i];
        if (extraField.id === 0x0001) {
          zip64EiefBuffer = extraField.data;
          break;
        }
      }
      if (zip64EiefBuffer == null) {
        return this.throwErrorAndAutoClose(new Error("expected zip64 extended information extra field"));
      }
      let index = 0;
      // 0 - Original Size          8 bytes
      if (entry.uncompressedSize === 0xffffffff) {
        if (index + 8 > zip64EiefBuffer.length) {
          return this.throwErrorAndAutoClose(new Error("zip64 extended information extra field does not include uncompressed size"));
        }
        entry.uncompressedSize = yauzl.readUInt64LE(zip64EiefBuffer, index);
        index += 8;
      }
      // 8 - Compressed Size        8 bytes
      if (entry.compressedSize === 0xffffffff) {
        if (index + 8 > zip64EiefBuffer.length) {
          return this.throwErrorAndAutoClose(new Error("zip64 extended information extra field does not include compressed size"));
        }
        entry.compressedSize = yauzl.readUInt64LE(zip64EiefBuffer, index);
        index += 8;
      }
      // 16 - Relative Header Offset 8 bytes
      if (entry.relativeOffsetOfLocalHeader === 0xffffffff) {
        if (index + 8 > zip64EiefBuffer.length) {
          return this.throwErrorAndAutoClose(new Error("zip64 extended information extra field does not include relative header offset"));
        }
        entry.relativeOffsetOfLocalHeader = yauzl.readUInt64LE(zip64EiefBuffer, index);
        index += 8;
      }
      // 24 - Disk Start Number      4 bytes
    }

    // check for Info-ZIP Unicode Path Extra Field (0x7075)
    // see https://github.com/thejoshwolfe/yauzl/issues/33
    if (this.decodeStrings) {
      for (i = 0; i < entry.extraFields.length; i++) {
        const extraField = entry.extraFields[i];
        if (extraField.id === 0x7075) {
          if (extraField.data.length < 6) {
            // too short to be meaningful
            continue;
          }
          // Version       1 byte      version of this extra field, currently 1
          if (extraField.data.readUInt8(0) !== 1) {
            // > Changes may not be backward compatible so this extra
            // > field should not be used if the version is not recognized.
            continue;
          }
          // NameCRC32     4 bytes     File Name Field CRC32 Checksum
          const oldNameCrc32 = extraField.data.readUInt32LE(1);
          if (unsigned(buffer.subarray(0, entry.fileNameLength)) !== oldNameCrc32) {
            // > If the CRC check fails, this UTF-8 Path Extra Field should be
            // > ignored and the File Name field in the header should be used instead.
            continue;
          }
          // UnicodeName   Variable    UTF-8 version of the entry File Name
          entry.fileName = yauzl.decodeBuffer(extraField.data, 5, extraField.data.length, true);
          break;
        }
      }
    }

    // validate file size
    if (this.validateEntrySizes && entry.compressionMethod === 0) {
      let expectedCompressedSize = entry.uncompressedSize;
      if (entry.isEncrypted()) {
        // traditional encryption prefixes the file data with a header
        expectedCompressedSize += 12;
      }
      if (entry.compressedSize !== expectedCompressedSize) {
        const msg = "compressed/uncompressed size mismatch for stored file: " + entry.compressedSize + " != " + entry.uncompressedSize;
        return this.throwErrorAndAutoClose(new Error(msg));
      }
    }

    if (this.decodeStrings) {
      if (!this.strictFileNames) {
        // allow backslash
        entry.fileName = entry.fileName.replace(/\\/g, "/");
      }
      const errorMessage = this.validateFileName(entry.fileName);
      if (errorMessage != null) return this.throwErrorAndAutoClose(new Error(errorMessage));
    }
    return entry;
  }
  getInStream(entry, options, bufferSize) {
    // parameter validation
    let relativeStart = 0;
    let relativeEnd = entry.compressedSize;

    // validate options that the caller has no excuse to get wrong
    if (options.decrypt != null) {
      if (!entry.isEncrypted()) {
        throw new Error("options.decrypt can only be specified for encrypted entries");
      }
      if (options.decrypt !== false) throw new Error("invalid options.decrypt value: " + options.decrypt);
      if (entry.isCompressed()) {
        if (options.decompress !== false) throw new Error("entry is encrypted and compressed, and options.decompress !== false");
      }
    }
    if (options.decompress != null) {
      if (!entry.isCompressed()) {
        throw new Error("options.decompress can only be specified for compressed entries");
      }
      if (!(options.decompress === false || options.decompress === true)) {
        throw new Error("invalid options.decompress value: " + options.decompress);
      }
    }
    if (options.start != null || options.end != null) {
      if (entry.isCompressed() && options.decompress !== false) {
        throw new Error("start/end range not allowed for compressed entry without options.decompress === false");
      }
      if (entry.isEncrypted() && options.decrypt !== false) {
        throw new Error("start/end range not allowed for encrypted entry without options.decrypt === false");
      }
    }
    if (options.start != null) {
      relativeStart = options.start;
      if (relativeStart < 0) throw new Error("options.start < 0");
      if (relativeStart > entry.compressedSize) throw new Error("options.start > entry.compressedSize");
    }
    if (options.end != null) {
      relativeEnd = options.end;
      if (relativeEnd < 0) throw new Error("options.end < 0");
      if (relativeEnd > entry.compressedSize) throw new Error("options.end > entry.compressedSize");
      if (relativeEnd < relativeStart) throw new Error("options.end < options.start");
    }
    // any further errors can either be caused by the zipfile,
    // or were introduced in a minor version of yauzl
    if (!this.isOpen) throw new Error("closed");
    if (entry.isEncrypted()) {
      if (options.decrypt !== false) throw new Error("entry is encrypted, and options.decrypt !== false");
    }

    const buffer = Buffer.allocUnsafe(30);
    yauzl.readAndAssertNoEof(this.reader, buffer, 0, buffer.length, entry.relativeOffsetOfLocalHeader);

    // 0 - Local file header signature = 0x04034b50
    const signature = buffer.readUInt32LE(0);
    if (signature !== 0x04034b50) {
      throw new Error("invalid local file header signature: 0x" + signature.toString(16));
    }
    // all this should be redundant
    // 4 - Version needed to extract (minimum)
    // 6 - General purpose bit flag
    // 8 - Compression method
    // 10 - File last modification time
    // 12 - File last modification date
    // 14 - CRC-32
    // 18 - Compressed size
    // 22 - Uncompressed size
    // 26 - File name length (n)
    const fileNameLength = buffer.readUInt16LE(26);
    // 28 - Extra field length (m)
    const extraFieldLength = buffer.readUInt16LE(28);
    // 30 - File name
    // 30+n - Extra field
    const localFileHeaderEnd = entry.relativeOffsetOfLocalHeader + buffer.length + fileNameLength + extraFieldLength;
    let decompress;
    if (entry.compressionMethod === 0) {
      // 0 - The file is stored (no compression)
      decompress = false;
    } else if (entry.compressionMethod === 8) {
      // 8 - The file is Deflated
      decompress = options.decompress != null ? options.decompress : true;
    } else {
      throw new Error("unsupported compression method: " + entry.compressionMethod);
    }
    const fileDataStart = localFileHeaderEnd;
    const fileDataEnd = fileDataStart + entry.compressedSize;
    if (entry.compressedSize !== 0) {
      // bounds check now, because the read streams will probably not complain loud enough.
      // since we're dealing with an unsigned offset plus an unsigned size,
      // we only have 1 thing to check for.
      if (fileDataEnd > this.fileSize) {
        throw new Error("file data overflows file bounds: " +
          fileDataStart + " + " + entry.compressedSize + " > " + this.fileSize);
      }
    }

    // In stream generation
    if (decompress)
      return new InflateInStream(this.reader, fileDataStart, entry.compressedSize, bufferSize);
    else
      return new ZipInStream(this.reader, fileDataStart, entry.compressedSize, bufferSize);

    // const readStream = this.reader.createReadStream({
    //   start: fileDataStart + relativeStart,
    //   end: fileDataStart + relativeEnd,
    // });
    // let endpointStream = readStream;
    // if (decompress) {
    //   let destroyed = false;
    //   const inflateFilter = zlib.createInflateRaw();
    //   readStream.on("error", function (err) {
    //     // setImmediate here because errors can be emitted during the first call to pipe()
    //     setImmediate(function () {
    //       if (!destroyed) inflateFilter.emit("error", err);
    //     });
    //   });
    //   readStream.pipe(inflateFilter);

    //   if (this.validateEntrySizes) {
    //     endpointStream = new AssertByteCountStream(entry.uncompressedSize);
    //     inflateFilter.on("error", function (err) {
    //       // forward zlib errors to the client-visible stream
    //       setImmediate(function () {
    //         if (!destroyed) endpointStream.emit("error", err);
    //       });
    //     });
    //     inflateFilter.pipe(endpointStream);
    //   } else {
    //     // the zlib filter is the client-visible stream
    //     endpointStream = inflateFilter;
    //   }
    //   // this is part of yauzl's API, so implement this function on the client-visible stream
    //   endpointStream.destroy = function () {
    //     destroyed = true;
    //     if (inflateFilter !== endpointStream) inflateFilter.unpipe(endpointStream);
    //     readStream.unpipe(inflateFilter);
    //     // TODO: the inflateFilter may cause a memory leak. see Issue #27.
    //     readStream.destroy();
    //   };
    // }
    // return endpointStream;
  }
  throwErrorAndAutoClose(err) {
    if (this.autoClose) this.close();
    throw err;
  }
  validateFileName(fileName) {
    if (fileName.indexOf("\\") !== -1) {
      return "invalid characters in fileName: " + fileName;
    }
    if (/^[a-zA-Z]:/.test(fileName) || /^(\/)/.test(fileName)) {
      return "absolute path: " + fileName;
    }
    if (fileName.split("/").indexOf("..") !== -1) {
      return "invalid relative path: " + fileName;
    }
    // all good
    return null;
  }
}

class YauzlEntry {

  // all these are numbers
  versionMadeBy;
  versionNeededToExtract;
  generalPurposeBitFlag;
  compressionMethod;
  lastModFileTime; // (MS-DOS format, see getLastModDateTime)
  lastModFileDate; // (MS-DOS format, see getLastModDateTime)
  crc32;
  compressedSize;
  uncompressedSize;
  fileNameLength; // (bytes)
  extraFieldLength; // (bytes)
  fileCommentLength; // (bytes)
  internalFileAttributes;
  externalFileAttributes;
  relativeOffsetOfLocalHeader;

  fileName;
  extraFields;
  fileComment;

  getLastModDate() {
    return dosDateTimeToDate(this.lastModFileDate, this.lastModFileTime);
  }
  isEncrypted() {
    return (this.generalPurposeBitFlag & 0x1) !== 0;
  }
  isCompressed() {
    return this.compressionMethod === 8;
  }
}

class YauzlFileReader {
  constructor(fd) {
    this.#fd = fd;
  }

  #fd;
  posMatters = true;

  read(buffer, offset, length, position) {
    return node.fs.readSync(this.#fd, buffer, offset, length, position);
  }

  close() {
    node.fs.closeSync(this.#fd);
  }
}