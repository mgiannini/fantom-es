//
// Copyright (c) 2017, Brian Frank and Andy Frank
// Licensed under the Academic Free License version 3.0
//
// History:
//   27 Nov 2017  Andy Frank  Creation
//   17 Apr 2023  Matthew Giannini  Refactor to ES
//

/**
 * ConstBuf.
 */
class ConstBuf extends Buf {
  constructor() {
    // TODO:FIXIT
    super();
  }

//////////////////////////////////////////////////////////////////////////
// Obj
//////////////////////////////////////////////////////////////////////////

  

  isImmutable() { return true; }

  toImmutable() { return this; }
}
