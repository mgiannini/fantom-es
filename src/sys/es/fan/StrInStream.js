//
// Copyright (c) 2009, Brian Frank and Andy Frank
// Licensed under the Academic Free License version 3.0
//
// History:
//   11 May 2009  Andy Frank  Creation
//   20 May 2009  Andy Frank  Refactor to new OO model
//   25 Apr 2023  Matthew Giannini  Refactor to ES
//

/**
 * StrInStream
 */
class StrInStream extends InStream {

//////////////////////////////////////////////////////////////////////////
// Constructor
//////////////////////////////////////////////////////////////////////////

  constructor(str) {
    super();
    this.#str = str;
    this.#size = str.length;
    this.#pos = 0;
    this.#pushback = null;
  }

  #str;
  #size;
  #pos;
  #pushback;

//////////////////////////////////////////////////////////////////////////
// InStream
//////////////////////////////////////////////////////////////////////////

  read() {
    const b = this.rChar$();
    return (b < 0) ? null : b & 0xFF;
  }

  readBuf(buf, n) {
    for (let i=0; i<n; ++i) {
      const c = this.rChar();
      if (c < 0) return i == 0 ? null : i;
      buf.out().writeChar(c);
    }
    return n;
  }

  unread(c) {
    return this.unreadChar(c);
  }

  rChar$() {
    if (this.#pushback != null && this.#pushback.length > 0)
      return this.#pushback.pop();
    if (this.#pos >= this.#size) return -1;
    return this.#str.charCodeAt(this.#pos++);
  }

  readChar() {
    const c = this.rChar$();
    return (c < 0) ? null : c;
  }

  unreadChar(c) {
    if (this.#pushback == null) this.#pushback = [];
    this.pushback.push(c);
    return this;
  }

  close() { return true; }

}