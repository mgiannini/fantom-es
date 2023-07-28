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

  static make(yauzlEntry, yauzlZip) {
    const instance = new ZipEntryFile(Uri.fromStr("/" + yauzlEntry.fileName));
    return instance;
  }

}