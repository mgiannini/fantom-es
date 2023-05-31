//
// Copyright (c) 2011 Brian Frank and Andy Frank
// Licensed under the Academic Free License version 3.0
//
// History:
//   03 Jan 2011  Andy Frank  Creation
//   12 Apr 2023  Matthew Giannini  Refactor for ES
//

/*************************************************************************
 * Facet
 ************************************************************************/

class Facet extends Obj {
  constructor() { super(); }
}

/*************************************************************************
 * Deprecated
 ************************************************************************/

class Deprecated extends Obj {
  constructor(f=null) { 
    super(); 
    this.#msg;
    if (f != null) f(this);
  }

  #msg;

  msg(it=undefined) {
    if (it === undefined) return this.#msg;
    this.#msg = it;
  }

  static make(f=null) { return new Deprecated(f); }
  
  toStr() { return fanx_ObjEncoder.encode(this); }
}

/*************************************************************************
 * FacetMeta
 ************************************************************************/

class FacetMeta extends Obj {
  constructor(f=null) { 
    super(); 
    this.#inherited = false;
    if (f != null) f(this);
  }

  #inherited;

  inherited(it=undefined) {
    if (it === undefined) return this.#inherited;
    this.#inherited = it;
  }

  static make(f=null) { return new FacetMeta(f); }
  
  toStr() { return fanx_ObjEncoder.encode(this); }
}

/*************************************************************************
 * Js
 ************************************************************************/

class Js extends Obj {
  constructor() { super(); }
  static defVal = new Js();
  
  toStr() { return this.typeof$().qname(); }
}

/*************************************************************************
 * NoDoc
 ************************************************************************/

class NoDoc extends Obj {
  constructor() { super(); }
  static defVal = new NoDoc();
  
  toStr() { return this.typeof$().qname(); }
}

/*************************************************************************
 * Operator
 ************************************************************************/

class Operator extends Obj {
  constructor() { super(); }
  static defVal = new Operator();
  
  toStr() { return this.typeof$().qname(); }
}

/*************************************************************************
 * Serializable
 ************************************************************************/

class Serializable extends Obj {
  constructor(f=null) { 
    super(); 
    this.#simple = false;
    this.#collection = false;
    if (f != null) f(this);
  }

  #simple;
  #collection;

  simple(it=undefined) {
    if (it === undefined) return this.#simple;
    this.#simple = it;
  }

  collection(it=undefined) {
    if (it === undefined) return this.#collection;
    this.#collection = it;
  }

  static make(f=null) { return new Serializable(f); }
  
  toStr() { return fanx_ObjEncoder.encode(this); }
}

/*************************************************************************
 * Transient
 ************************************************************************/

class Transient extends Obj {
  constructor() { super(); }
  static defVal = new Transient();
  
  toStr() { return this.typeof$().qname(); }
}

