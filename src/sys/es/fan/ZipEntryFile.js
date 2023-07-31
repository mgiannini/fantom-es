//
// Copyright (c) 2023, Brian Frank and Andy Frank
// Licensed under the Academic Free License version 3.0
//
// History:
//   28 Jul 2023  Kiera O'Flynn  Creation
//

/**
 * ZipEntryFile.
 */
class ZipEntryFile extends File {

//////////////////////////////////////////////////////////////////////////
// Construction
//////////////////////////////////////////////////////////////////////////

  constructor(uri) {
    super(uri);
  }

  #isFileBacked = false;
  #entry;
  #zip;

  static makeFromFile(yauzlEntry, zip) {
    const instance = new ZipEntryFile(Uri.fromStr("/" + yauzlEntry.fileName));
    instance.#isFileBacked = true;
    instance.#entry = yauzlEntry;
    instance.#zip = zip;
    return instance;
  }

//////////////////////////////////////////////////////////////////////////
// Info
//////////////////////////////////////////////////////////////////////////

  exists() {
    return true;
  }

  modified(val) {
    if (val)
      throw IOErr.make("ZipEntryFile is readonly");

    return yauzl.dosDateTimeToFantom(this.#entry.lastModFileDate, this.#entry.lastModFileTime);
  }

  size() {
    return this.#entry.uncompressedSize;
  }

  normalize() {
    return this;
  }

  osPath() {
    return null;
  }

//////////////////////////////////////////////////////////////////////////
// Navigation
//////////////////////////////////////////////////////////////////////////

  list(pattern) {
    if (!this.#isFileBacked || !this.uri().isDir())
      return List.make(File.type$, []);

    return this.#zip.contents().findAll((uri, f) => {
      this.uri().equals(uri.parent()) &&
      (!pattern || pattern.matches(uri.name))
    }).vals();
  }

  parent() {
    if (!this.#isFileBacked)
      return null;
    return this.#zip.contents().get(this.uri().parent());
  }

  plus(path, checkSlash=true) {
    if (!this.#isFileBacked)
      return File.make(newUri, checkSlash); // nonexistent file

    const newUri = this.uri().plus(path);
    const a = this.#zip.contents().get(newUri);
    if (a) return a;
    const b = this.#zip.contents().get(newUri.plusSlash());
    if (b) {
      if (checkSlash) throw IOErr.make("Must use trailing slash for dir: " + newUri.toString());
      else return b;
    }
    return File.make(newUri, checkSlash); // nonexistent file
  }

//////////////////////////////////////////////////////////////////////////
// Reading
//////////////////////////////////////////////////////////////////////////

  in(bufferSize) {
    //
  }

}