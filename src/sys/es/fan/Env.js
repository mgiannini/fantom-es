//
// Copyright (c) 2010, Brian Frank and Andy Frank
// Licensed under the Academic Free License version 3.0
//
// History:
//   12 Jan 2010  Andy Frank  Creation
//   17 Apr 2023  Matthew Giannini  Refactor for ES
//

/**
 * Env
 */
class Env extends Obj {

//////////////////////////////////////////////////////////////////////////
// Construction
//////////////////////////////////////////////////////////////////////////

  constructor() {
    super();
    this.#args = List.make(Str.type$).toImmutable();
    this.#index = Map.make(Str.type$, new ListType(Str.type$)).toImmutable();
    this.#vars = Map.make(Str.type$, Str.type$);
    // TODO: FIXIT 
  }

  #args;
  #index;
  #vars;
  #props

  static #cur = undefined;
  static cur() {
    if (Env.#cur === undefined) Env.#cur = new Env()
    return Env.#cur;
  }

  static configProps() { return Uri.fromStr("config.props"); }
  static localeEnProps() { return Uri.fromStr("locale/en.props"); }

  static invokeMain$(qname) {
    // resolve qname to method
    const dot = qname.indexOf('.');
    if (dot < 0) qname += '.main';
    const main = Slot.findMethod(qname);

    // invoke main
    if (main.isStatic()) main.call();
    else main.callOn(main.parent().make());
  }

  static node$(module=null) {
    if (typeof node === "undefined") throw UnsupportedErr.make("Only supported in Node runtime");
    return module == null ? node : node[module];
  }

//////////////////////////////////////////////////////////////////////////
// Obj
//////////////////////////////////////////////////////////////////////////

  $typeof() { return Env.type$; }

  toStr() { return this.typeof$().toString(); }

//////////////////////////////////////////////////////////////////////////
// Non-Virtuals
//////////////////////////////////////////////////////////////////////////

  runtime() { return "js"; }

  javaVersion() { return 0; }

  os() { 
    let p = Env.node$().os.platform();
    if (p === "darwin") p = "macosx";
    return p;
  }

  arch() {
    let a = Env.node$().os.arch();
    switch (a) {
      case "ia32": a = "x86";
      case "x64":  a = "x86_64";
    }
    return a;
  }

  platform() { return `${this.os()}-${this.arch()}`; }

  // TODO: FIXIT

//////////////////////////////////////////////////////////////////////////
// Virtuals
//////////////////////////////////////////////////////////////////////////

  args() { return this.#args; }

  vars() { return this.#vars; }

  diagnostics() { return Map.make(Str.type$, Obj.type$); }

  user() { return "unknown"; }

  // TODO: FIXIT

}
