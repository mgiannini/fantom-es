//
// Copyright (c) 2009, Brian Frank and Andy Frank
// Licensed under the Academic Free License version 3.0
//
// History:
//   24 Mar 2009  Andy Frank  Creation
//   20 May 2009  Andy Frank  Refactor to new OO model
//   07 Apr 2023  Matthew Giannini  Refactor for ES
//

/**
 * Func
 */
class Func extends Obj {

//////////////////////////////////////////////////////////////////////////
// Constructor
//////////////////////////////////////////////////////////////////////////

// TODO:FIXIT a lot to fix in here
  constructor(params, ret, func) {
    super();
    // this.#params = params;
    // this.#ret = ret;
    // this.#func = func;
    // this.#type = new FuncType()
  }

  #params;
  #ret;
  #type;
  #func;

  // TODO:FIXIT other constructors

//////////////////////////////////////////////////////////////////////////
// Identity 
//////////////////////////////////////////////////////////////////////////

  typeof$() { return this.#type; }

  toImmutable() {
    if (this.isImmutable()) return this;
    throw NotImmutableErr.make("Func");
  }

//////////////////////////////////////////////////////////////////////////
// Methods
//////////////////////////////////////////////////////////////////////////

  params() { return this.#params; }
  arity() { return this.#params.size(); }
  returns() { return this.#ret; }
  method() { return null; }

  call() { return this.#func.apply(null, arguments); }
  callList(args) { return this.#func.apply(null, args.values$()); }
  callOn(obj, args) { return this.#func.apply(obj, args.values$()); }

  //TODO:bind() - never implemented?

  enterCtor(obj) {}
  exitCtor() {}
  checkInCtor(obj) {}

  toStr() { return "sys::Func"; }
  
  // TODO:FIXIT
  // retype(t) {
  //   if (t instanceof FuncType) {
  //     var params = [];
  //     for (let i=0; i < t.pars.length; ++i)
  //       params.push(new Param(String.fromCharCode(i+65), t.pars[i], 0));
  //     let paramList = List.make(Param.type$, params);
  //     return Func.make(paramList, t.ret, this.#func);
  //   }
  //   else
  //     throw ArgErr.make(`Not a Func type ${t}`);
  // }

//////////////////////////////////////////////////////////////////////////
// Compiler Support
//////////////////////////////////////////////////////////////////////////

  static r$(func, type) { func.__returns = type; return func; }

}