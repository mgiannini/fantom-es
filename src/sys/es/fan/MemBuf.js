//
// Copyright (c) 2009, Brian Frank and Andy Frank
// Licensed under the Academic Free License version 3.0
//
// History:
//   13 Jun 2009  Andy Frank  Creation
//   27 Jun 2023  Matthew Giannini  Refactor for ES
//

/**
 * MemBuf.
 */
class MemBuf extends Buf {

//////////////////////////////////////////////////////////////////////////
// Constructor
//////////////////////////////////////////////////////////////////////////

  constructor(data=new Int8Array(), size=0) {
    super();
    this.data   = data;
    this.__size = size;
    this.__pos  = 0;
    this.__out  = MemBufOutStream.make(this);
    this.__in   = MemBufInStream.make(this);
  }

  data;
  __size;
  __pos;
  __out;
  __in;


  static makeCapacity(capacity) {
    const buf = new MemBuf();
    buf.capacity(capacity);
    return buf;
  }

  static __makeBytes(bytes) {
    const buf = new MemBuf();
    buf.data   = bytes instanceof Array ? new Int8Array(bytes) : bytes;
    buf.__size = bytes.length;
    return buf;
  }

//////////////////////////////////////////////////////////////////////////
// Obj
//////////////////////////////////////////////////////////////////////////

  toImmutable() {
    const data  = this.data;
    const size  = this.__size;
    this.data   = new Int8Array();
    this.__size = 0;
    return new ConstBuf(data, size, this.endian(), this.charset());
  }

//////////////////////////////////////////////////////////////////////////
// Buf Support
//////////////////////////////////////////////////////////////////////////

  size(it) { 
    if (it === undefined) return this.__size;
    if (it > this.data.length) {
      this.grow(it, true);
    }
    this.__size = it;
  }

  pos(it) {
    if (it === undefined) return this.__pos;
    this.__pos = it;
  }

  __getByte(pos) {
    return this.data[pos] & 0xFF;
  }

  __setByte(pos, x) {
    this.data[pos] = x & 0xFF;
  }

  __getBytes(pos, len) {
    // TODO:FIXIT - should this return a new MemBuf instead of TypedArray?
    return this.data.slice(pos, pos+len);
  }
/*

//////////////////////////////////////////////////////////////////////////
// Java IO Streams (Rhino)
//////////////////////////////////////////////////////////////////////////

fan.sys.MemBuf.prototype.pipeTo = function(dst, len)
{
  if (this.m_pos+len > this.m_size) throw fan.sys.IOErr.make("Not enough bytes to write");
  var byteArray = this.cpMemToJavaBuffer(len)
  dst.write(byteArray, 0, len);
  this.m_pos += len;
}

fan.sys.MemBuf.prototype.pipeFrom = function(src, len)
{
  this.grow(this.m_pos + len);
  var byteArray = new java.lang.reflect.Array.newInstance(java.lang.Byte.TYPE, len);
  var read = src.read(byteArray, 0, len);
   if (read < 0) return -1;
  this.cpJavaBufferToMem(byteArray, read);
  this.m_pos += read;
  this.m_size = this.m_pos;
  return read;
}

fan.sys.MemBuf.prototype.cpMemToJavaBuffer = function(len)
{
  var bytes = new java.lang.reflect.Array.newInstance(java.lang.Byte.TYPE, len);
  for (var i=0; i<len; ++i)
  {
    var b = this.m_buf[this.m_pos+i];
    if (b > 127) b |= 0xFFFFFF00;
    bytes[i] = b;
  }
  return bytes;
}

fan.sys.MemBuf.prototype.cpJavaBufferToMem = function(bytes, len)
{
  for (var i=0; i<len; ++i)
    this.m_buf[this.m_pos+i] = bytes[i] & 0xFF;
}

//////////////////////////////////////////////////////////////////////////
// Buf API
//////////////////////////////////////////////////////////////////////////
*/

  capacity(it) {
    if (it === undefined) return this.data.length;
    if (it < this.__size) throw ArgErr.make(`capacity < size`);
    if (it < this.data.length) {
      // shrink
      this.data = this.data.slice(0, it);
    } else {
      this.grow(it, true);
    }
    return this.data.length;
  }

  trim() {
    if (this.__size == this.data.length) return this;
    this.data = this.data.slice(0, size);
    return this;
  }

//////////////////////////////////////////////////////////////////////////
// File
//////////////////////////////////////////////////////////////////////////

  toFile(uri) { return MemFile.make(this.toImmutable(), uri); }

//////////////////////////////////////////////////////////////////////////
// Internal Support
//////////////////////////////////////////////////////////////////////////

  grow(capacity, exact=false) {
    if (this.data.length >= capacity) return;
    const newSize = exact ? capacity : Math.max(capacity, this.__size*2);
    const temp = new Int8Array(newSize);
    temp.set(this.data);
    this.data = temp;
  }

  __unsafeArray() { return this.data; }

  static __concat(a, b) {
    const c = new Int8Array(a.length + b.length);
    c.set(a);
    c.set(b, a.length);
    return c;
  }
}