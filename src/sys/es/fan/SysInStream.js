//
// Copyright (c) 2010, Brian Frank and Andy Frank
// Licensed under the Academic Free License version 3.0
//
// History:
//  01 Sep 2019  Andy Frank  Creation
//  06 Jul 2023  Matthew Giannini Refactor for ES
//

/**
 * SysInStream
 */
class SysInStream extends InStream {

//////////////////////////////////////////////////////////////////////////
// Constructor
//////////////////////////////////////////////////////////////////////////

  constructor() { super(); }

  static make(ins) {
    const self = new SysInStream();
    SysInStream.make$(self, ins);
    return self;
  }

  static make$(self, ins) {
    InStream.make$(self, ins);
  }

//////////////////////////////////////////////////////////////////////////
// InStream
//////////////////////////////////////////////////////////////////////////

/*
fan.sys.SysInStream.prototype.read = function()
{
  var n = this.r();
  return n < 0 ? null : n;
}
fan.sys.SysInStream.prototype.r = function()
{
  try
  {
    return this.m_in.read();
  }
  catch (e)
  {
    throw fan.sys.IOErr.make(e);
  }
}

fan.sys.SysInStream.prototype.readChar = function()
{
  var c = this.rChar()
  return (c < 0) ? null : c;
}

fan.sys.SysInStream.prototype.rChar = function()
{
  return this.m_charset.m_encoder.decode(this);
}

fan.sys.SysInStream.prototype.readBuf = function(buf, n)
{
  try
  {
    var read = buf.pipeFrom(this.m_in, n);
    if (read < 0) return null;
    return read;
  }
  catch (e)
  {
    throw fan.sys.IOErr.make(e);
  }
}

fan.sys.SysInStream.prototype.unread = function(n)
{
  try
  {
    // don't take the hit until we know we need to wrap
    // the raw input stream with a pushback stream
    if (!(this.m_in instanceof java.io.PushbackInputStream))
      this.m_in = new java.io.PushbackInputStream(this.m_in, 128);
    this.m_in.unread(n);
    return this;
  }
  catch (e)
  {
    throw fan.sys.IOErr.make(e);
  }
}

fan.sys.SysInStream.prototype.skip = function(n)
{
  try
  {
    var skipped = this.m_in.skip(n);
    if (skipped < 0) return 0;
    return skipped;
  }
  catch (e)
  {
    throw fan.sys.IOErr.make(e);
  }
}

fan.sys.SysInStream.prototype.close = function()
{
  try
  {
    if (this.m_in != null) this.m_in.close();
    return true;
  }
  catch (e)
  {
    return false;
  }
}
*/
}

/*************************************************************************
 * LocalFileInStream
 ************************************************************************/

class LocalFileInStream extends SysInStream {
  constructor(fd, bufSize) { 
    super(); 
    this.#fd  = fd;
    this.#buf = Buffer.alloc(bufSize);
    this.#load();
  }

  #fd;
  #pre = [];
  #buf;
  #start = 0;
  #end = 0;

  static make(fd, bufSize) {
    const self = new LocalFileInStream(fd, bufSize);
    LocalFileInStream.make$(self);
    return self;
  }

  static make$(self) {
    SysInStream.make$(self);
  }

  #load() {
    this.#start = 0;
    this.#end = node.fs.readSync(this.#fd, this.#buf);
  }

  avail() {
    return this.#pre.length + (this.#end - this.#start);
  }

  #r() {
    try {
      if (this.avail() === 0)
        this.#load();
      else if (this.#pre.length > 0)
        return this.#pre.pop();

      if (this.avail() == 0) {
        return -1;
      }
      const x = this.#buf[this.#start++];
      return x
    }
    catch (e) {
      throw IOErr.make(e);
    }
  }

  read() {
    const n = this.#r();
    return n < 0 ? null : n;
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
    return read == 0 ? null : read;
  }

  unread(n) { this.#pre.push(n); }

  skip(n) {
    let skipped = 0;

    if (this.#pre.length > 0) {
      const len = Math.min(this.#pre.length, n);
      this.#pre = this.#pre.slice(0, -len);
      n -= len;
      skipped += len;
    }

    if (this.avail() === 0)
      this.#load();
    while (this.avail() > n) {
      n -= this.avail();
      skipped += this.avail();
      this.#load();
    }

    n = Math.min(this.avail(), n);

    start += n;
    skipped += n;

    return skipped;
  }

  close() {
    try {
      node.fs.closeSync(this.#fd);
      return true;
    }
    catch (e) {
      return false;
    }
  }
}