//
// Copyright (c) 2023, Brian Frank and Andy Frank
// Licensed under the Academic Free License version 3.0
//
// History:
//   21 Mar 2023  Matthew Giannini  Creation
//   25 Apr 2023  Matthew Giannini  Refactor for ES
//

/**
 * Zip.
 */
class Zip extends Obj {
  constructor()
  {
    super();
    if (!Env.__isNode())
      throw UnsupportedErr.make("Zip is only available in a node environment.")
  }

  #yauzlZip;

  #file;
  #in;
  #out;

//////////////////////////////////////////////////////////////////////////
// Static constructors
//////////////////////////////////////////////////////////////////////////

  static open(file)
  {
    if (!file.exists() || file.osPath() === null)
      throw IOErr.make("File must exist on the local filesystem");
    if (file.isDir())
      throw IOErr.make("Cannot unzip a directory");

    const zip = new Zip();
    zip.#file = file;
    zip.#yauzlZip = yauzl.open(file.osPath());
    return zip;
  }

  static read(in$)
  {
    const zip = new Zip();
    zip.#in = in$;
    zip.#yauzlZip = yauzl.fromStream(in$);
    return zip;
  }

  static write(out)
  {
    const zip = new Zip();
    zip.#out = out;
    return zip;
  }

//////////////////////////////////////////////////////////////////////////
// File reading-only
//////////////////////////////////////////////////////////////////////////

  file()
  {
    return this.#file || null;
  }

  #contents;
  contents()
  {
    if (!this.#file) return null;
    if (this.#contents) return this.#contents;

    const map = Map.make(Uri.type$, File.type$);

    // Get each entry
    let entry;
    while (!!(entry = this.#yauzlZip.getEntry())) {
      map.add(Uri.fromStr("/" + entry.fileName), ZipEntryFile.makeFromFile(entry, this.#yauzlZip, this));
    }

    this.#contents = map.ro();
    return this.#contents;
  }

//////////////////////////////////////////////////////////////////////////
// InStream reading-only
//////////////////////////////////////////////////////////////////////////

  #lastFile;
  readNext()
  {
    if (!this.#in)
      throw UnsupportedErr.make("Not reading from an input stream");
    if (this.#lastFile) {
      this.#lastFile.__in().skip(this.#lastFile.__in().remaining());
      this.#lastFile.__in().close();
    }

    const entry = this.#yauzlZip.getEntryFromStream();
    if (!entry) return null;
    return (this.#lastFile = ZipEntryFile.makeFromStream(entry, this.#yauzlZip));
  }
  /**
   * Call the specified function for every entry in the zip. Use
   * the File's input stream to read the file contents.  Some
   * file meta-data such as size may not be available. Throw
   * UnsupportedErr if not reading from an input stream.
   */
  readEach(c)
  {
    if (!this.#in)
      throw UnsupportedErr.make("Not reading from an input stream");

    for(let f = this.readNext(); f != null; f = this.readNext())
      c(f);
  }

//////////////////////////////////////////////////////////////////////////
// OutStream writing-only
//////////////////////////////////////////////////////////////////////////

  /**
   * Append a new file to the end of this zip file and return an
   * OutStream which may be used to write the file contents.  The
   * Uri must not contain a query or fragment; it may optionally
   * start with a slash.  Closing the OutStream will close only
   * this file entry - use Zip.close() when finished writing the
   * entire zip file.  Throw UnsupportedErr if zip is not writing
   * to an output stream.
   * 
   * Next entry options:
   * - comment: Str entry comment
   * - crc: Int CRC-32 of the uncompressed data
   * - extra: Buf for extra bytes data field
   * - level: Int between 9 (best compression) to 0 (no
   *   compression)
   * - compressedSize: Int for compressed size of data
   * - uncompressedSize: Int for uncompressed size of data
   * 
   * NOTE: setting level to 0 sets method to STORE, else to DEFLATED.
   * 
   * Examples:
   * ```
   * out := zip.writeNext(`/docs/test.txt`)
   * out.writeLine("test")
   * out.close
   * ```
   */
  // writeNext(path: Uri, modifyTime?: DateTime, opts?: Map<string, JsObj | null> | null): OutStream
  writeNext(path, modifyTime=DateTime.now(), opts=null)
  {
    if (!this.#out)
      throw UnsupportedErr.make("Not writing to an output stream");

    // get the outstream
  }
  /**
   * Finish writing the contents of this zip file, but leave the
   * underlying OutStream open.  This method is guaranteed to
   * never throw an IOErr. Return true if the stream was finished
   * successfully or false if the an error occurred.  Throw
   * UnsupportedErr if zip is not not writing to an output
   * stream.
   */
  finish()
  {
    if (!this.#out)
      throw UnsupportedErr.make("Not writing to an output stream");
    
    // do the things
  }

//////////////////////////////////////////////////////////////////////////
// Other methods
//////////////////////////////////////////////////////////////////////////

  close() {
    try {
      if (this.#yauzlZip) {
        this.#yauzlZip.close();
      }
      if (this.#in) {
        this.#in.close();
      }
      if (this.#out) {
        this.#out.close();
      }

      return true;
    } catch (_) {
      return false;
    }
  }
  /**
   * Static utility to unzip a zip file to the given directory.
   * Raise exception if there is any failures.  Return number of
   * files unzipped on success.
   */
  // static unzipInto(zip: File, dir: File): number
  /**
   * Construct a new GZIP output stream which wraps the given
   * output stream.
   */
  // static gzipOutStream(out: OutStream): OutStream
  /**
   * Construct a new GZIP input stream which wraps the given
   * input stream.
   */
  // static gzipInStream(in$: InStream): InStream

  // static deflateOutStream(out, opts = null)
  // {

  // }
  /**
   * Construct a new deflate input stream which wraps the given
   * input stream and inflates data written using the "deflate"
   * compression format.  Options:
   * - nowrap: Bool false to suppress defalate header and adler
   *   checksum
   */
  // static deflateInStream(in$: InStream, opts?: Map<string, JsObj | null> | null): InStream

//////////////////////////////////////////////////////////////////////////
// Obj
//////////////////////////////////////////////////////////////////////////

  toStr()
  {
    if (this.#file) return this.#file.toStr();
    return super.toStr();
  }

}