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
    this.#props = Map.make(Str.type$, Str.type$);

    if (typeof fan$env !== 'undefined') { this.__loadVars(fan$env); }

    // TODO:FIXIT - pod props map, keyed by pod.name
    // TODO:FIXIT - user?

    this.#out = new ConsoleOutStream();
  }

  __loadVars(env) {
    if (!env) return
    const keys = Object.keys(env)
    for (let i=0; i<keys.length; ++i) {
      const k = keys[i];
      const v = env[k];
      this.#vars.set(k, v);
    }
    this.#vars = this.#vars.toImmutable();
  }

  #args;
  #index;
  #vars;
  #props;
  #out;
  __homeDir;
  __workDir;
  __tempDir;

  // used to display locale keys
  static __localeTestMode = false;

  static #cur = undefined;
  static cur() {
    if (Env.#cur === undefined) Env.#cur = new Env()
    return Env.#cur;
  }

  static configProps() { return Uri.fromStr("config.props"); }
  static localeEnProps() { return Uri.fromStr("locale/en.props"); }

  static __invokeMain(qname) {
    // resolve qname to method
    const dot = qname.indexOf('.');
    if (dot < 0) qname += '.main';
    const main = Slot.findMethod(qname);

    // invoke main
    if (main.isStatic()) main.call();
    else main.callOn(main.parent().make());
  }

  static __isNode() { return typeof node !== undefined; }

  static __node(module=null) {
    if (typeof node === "undefined") throw UnsupportedErr.make("Only supported in Node runtime");
    return module == null ? node : node[module];
  }

//////////////////////////////////////////////////////////////////////////
// Obj
//////////////////////////////////////////////////////////////////////////

  toStr() { return this.typeof$().toString(); }

//////////////////////////////////////////////////////////////////////////
// Non-Virtuals
//////////////////////////////////////////////////////////////////////////

  runtime() { return "js"; }

  javaVersion() { return 0; }

  os() { 
    let p = Env.__node().os.platform();
    if (p === "darwin") p = "macosx";
    return p;
  }

  arch() {
    let a = Env.__node().os.arch();
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

  out() { return this.#out; }

  // TODO: FIXIT - prompt

  homeDir() { return this.__homeDir; }

  workDir() { return this.__workDir; }
  
  tempDir() { return this.__tempDir; }

//////////////////////////////////////////////////////////////////////////
// State
//////////////////////////////////////////////////////////////////////////

  index(key) { return this.#index.get(key, Str.type$.emptyList()); }

  props(pod, uri, maxAge) {
    const key = `${pod.name$()}:${uri.toStr()}`;
    let map = this.#props.get(key);
    if (map == null) {
      map = Map.make(Str.type$, Str.type$).toImmutable();
      this.#props.add(key, map);
    }
    return map;
  }

  config(pod, key, def=null) {
    return this.props(pod, Uri.fromStr("config.props"), Duration.oneMin$()).get(key, def);
  }

  locale(pod, key, def, locale=Locale.cur()) {
    if (Env.__localeTestMode &&
        key.indexOf(".browser") == -1 &&
        key.indexOf(".icon") == -1 &&
        key.indexOf(".accelerator") == -1 &&
        pod.name$() != "sys") 
    { 
      return pod + "::" + key; 
    }

    // TODO: why was the old code doing this?
    // if (def === undefined) def = "_Env_nodef_";

    let val;
    const maxAge = Duration.maxVal();

    // 1. 'props(pod, `locale/{locale}.props`)'
    val = this.props(pod, locale.__strProps, maxAge).get(key, null);
    if (val != null) return val;

    // 2. 'props(pod, `locale/{lang}.props`)'
    val = this.props(pod, locale.__langProps, maxAge).get(key, null);
    if (val != null) return val;

    // 3. 'props(pod, `locale/en.props`)'
    val = this.props(pod, Uri.fromStr("locale/en.props"), maxAge).get(key, null);
    if (val != null) return val;

    // 4. Fallback to 'pod::key' unless 'def' specified
    if (def === undefined) return pod + "::" + key;
    return def;
  }

  // Internal compiler hook for setting properties
  __props(key, m) { this.#props.add(key, m.toImmutable()); }

}
