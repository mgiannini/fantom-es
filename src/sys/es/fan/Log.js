//
// Copyright (c) 2009, Brian Frank and Andy Frank
// Licensed under the Academic Free License version 3.0
//
// History:
//   24 Mar 2009  Andy Frank  Creation
//   20 May 2009  Andy Frank  Refactor to new OO model
//   20 Apr 2023  Matthew Giannini  Refactor to ES
//

/**
 * Log.
 */
class Log extends Obj {

//////////////////////////////////////////////////////////////////////////
// Construction
//////////////////////////////////////////////////////////////////////////

  constructor(name, level, register) {
    super();
    Uri.checkName(name);
    this.#name = name;
    this.#level = level;

    if (register) {
      if (Log.#byName[name] != null)
        throw ArgErr.make("Duplicate log name: " + name);
      
      // init and put into map
      Log.#byName[name] = this;
      
      // TODO FIXIT
      //    var val = (String)Sys.sysPod.props(Uri.fromStr("log.props"), Duration.oneMin).get(name);
      //    if (val != null) self.level = LogLevel.fromStr(val);
    }
  }

  #name;
  #level;
  static #byName = [];
  static #handlers = [];

  static list() {
    return List.make(Log.type$, Log.#byName).ro();
  }

  static find(name, checked=true) {
    const log = Log.#byName[name];
    if (log != null) return log;
    if (checked) throw Err.make("Unknown log: " + name);
    return null;
  }

  static get(name) {
    const log = Log.#byName[name];
    if (log != null) return log;
    return Log.make(name, true);
  }

  static make(name, register) {
    return new Log(name, LogLevel.info(), register);
  }

//////////////////////////////////////////////////////////////////////////
// Identity
//////////////////////////////////////////////////////////////////////////

  toStr() { return this.#name; }

  name$() { return this.#name; }

//////////////////////////////////////////////////////////////////////////
// Severity Level
//////////////////////////////////////////////////////////////////////////

  level(it=undefined) {
    if (it === undefined) return this.#level;
    if (level == null) throw ArgErr.make("level cannot be null");
    this.#level = it;
  }

  enabled(level) { return this.#level.ordinal() <= level.ordinal(); }

  isEnabled(level) { return this.enabled(level); }

  isErr()   { return this.isEnabled(LogLevel.err()); }
  isWarn()  { return this.isEnabled(LogLevel.warn()); }
  isInfo()  { return this.isEnabled(LogLevel.info()); }
  isDebug() { return this.isEnabled(LogLevel.debug()); }

//////////////////////////////////////////////////////////////////////////
// Logging
//////////////////////////////////////////////////////////////////////////

  err(msg, err=null)
  {
    this.log(LogRec.make(DateTime.now(), LogLevel.err(), this.#name, msg, err));
  }

  warn(msg, err=null)
  {
    this.log(LogRec.make(DateTime.now(), LogLevel.warn(), this.#name, msg, err));
  }

  info(msg, err=null)
  {
    this.log(LogRec.make(DateTime.now(), LogLevel.info(), this.#name, msg, err));
  }

  debug(msg, err=null)
  {
    this.log(LogRec.make(DateTime.now(), LogLevel.debug(), this.#name, msg, err));
  }

  log(rec) {
    if (!this.enabled(rec.level())) return;

    for (let i=0; i<Log.#handlers.length; ++i) {
      try { Log.#handlers[i](rec); }
      catch (e) { Err.make(e).trace(); }
    }
  }

//////////////////////////////////////////////////////////////////////////
// Handlers
//////////////////////////////////////////////////////////////////////////

  static handlers() { return List.make(Func.type$, Log.#handlers).ro(); }

  static addHandler(func) {
    // if (!func.isImmutable()) throw fan.sys.NotImmutableErr.make("handler must be immutable");
    Log.#handlers.push(func);
  }

  static removeHandler(func) {
    let index = null;
    for (let i=0; i<Log.#handlers.length; i++)
      if (Log.#handlers[i] == func) { index=i; break }

    if (index == null) return;
    Log.#handlers.splice(index, 1);
  }

}