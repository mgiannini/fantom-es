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

  #file;
  #in;
  #out;

//////////////////////////////////////////////////////////////////////////
// Static constructors
//////////////////////////////////////////////////////////////////////////

  static open(file)
  {
    const zip = new Zip();
    zip.#file = file;
    return zip;
  }

  static read(in$)
  {
    const zip = new Zip();
    zip.#in = in$;
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

  contents()
  {
    if (!this.#file) return null;

    const map = Map.make(Uri.type$, File.type$);

    // Load zip file
  }

//////////////////////////////////////////////////////////////////////////
// InStream reading-only
//////////////////////////////////////////////////////////////////////////

  /**
   * Read the next entry in the zip.  Use the File's input stream
   * to read the file contents.  Some file meta-data such as size
   * may not be available. Return null if at end of zip file. 
   * Throw UnsupportedErr if not reading from an input stream.
   */
  readNext()
  {
    if (!this.#in) return null;

    // return the File
    return null;
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

    // do the callback
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
  /**
   * Finish writing the contents of this zip file, but leave the
   * underlying OutStream open.  This method is guaranteed to
   * never throw an IOErr. Return true if the stream was finished
   * successfully or false if the an error occurred.  Throw
   * UnsupportedErr if zip is not not writing to an output
   * stream.
   */
  // finish(): boolean

//////////////////////////////////////////////////////////////////////////
// Other methods
//////////////////////////////////////////////////////////////////////////

  /**
   * Close this zip file for reading and writing.  If this zip
   * file is reading or writing an stream, then the underlying
   * stream is also closed.  This method is guaranteed to never
   * throw an IOErr.  Return true if the close was successful or
   * false if the an error occurred.
   */
  // close(): boolean
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