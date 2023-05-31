//
// Copyright (c) 2009, Brian Frank and Andy Frank
// Licensed under the Academic Free License version 3.0
//
// History:
//   24 Mar 2009  Andy Frank  Creation
//   20 May 2009  Andy Frank  Refactor to new OO model
//   17 Apr 2023  Matthew Giannini  Refactor to ES
//

/**
 * Charset.
 */
class Charset extends Obj {
  constructor(name, encoder) { 
    super(); 
    this.#name = name;
    this.#encoder = encoder;
  }

  #name;
  #encoder;

  
}
