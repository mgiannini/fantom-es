//
// Copyright (c) 2009, Brian Frank and Andy Frank
// Licensed under the Academic Free License version 3.0
//
// History:
//   07 Jul 2009  Andy Frank  Creation
//   20 Apr 2023  Matthew Giannini  Refactor for ES
//

/**
 * Locale.
 */
class Locale extends Obj {

//////////////////////////////////////////////////////////////////////////
// Construction
//////////////////////////////////////////////////////////////////////////

  constructor(str, lang, country) {
    super();
    this.#str = str;
    this.#lang = lang;
    this.#country = country;
    this.#strProps = Uri.fromStr(`locale/${str}.props`);
    this.#langProps = Uri.fromStr(`locale/${lange}.props`);
  }

  

  static #cur = undefined;
  static #en = undefined;

  #str;
  #lang;
  #country;
  #strProps;
  #langProps;

  static fromStr(s, checked=true)
  {
    const len = s.length;
    try {
      if (len == 2) {
        if (Str.isLower(s))
          return new Locale(s, s, null);
      }

      if (len == 5) {
        const lang = s.substring(0, 2);
        const country = s.substring(3, 5);
        if (Str.isLower(lang) && Str.isUpper(country) && s.charAt(2) == '-')
          return new Locale(s, lang, country);
      }
    }
    catch (err) {}
    if (!checked) return null;
    throw ParseErr.makeStr("Locale", s);
  }

//////////////////////////////////////////////////////////////////////////
// Thread
//////////////////////////////////////////////////////////////////////////

  static en() {
    if (Locale.#en === undefined) Locale.#en = Locale.fromStr("en");
    return Locale.#en;
  }

  static cur() {
    if (Locale.#cur === undefined) {
      // check for explicit locale from Env.vars or fallback to en-US
      let loc = Env.cur().vars().get("locale");
      if (loc == null) loc = "en-US"
      Locale.#cur = Locale.fromStr(loc);
    }
    return Locale.#cur;
  }

  static setCur(locale) {
    if (locale == null) throw NullErr.make();
    Locale.#cur = locale;
  }

  use(func) {
    const old = Locale.cur();
    try {
      Locale.setCur(this);
      func(this);
    }
    finally {
      Locale.setCur(old);
    }
    return this;
  }

//////////////////////////////////////////////////////////////////////////
// Methods
//////////////////////////////////////////////////////////////////////////

  lang() { return this.#lang; }

  country() { return this.#country; }

  hash() { return Str.hash(this.#str); }

  equals(obj) {
    if (obj instanceof Locale)
      return obj.#str == this.#str;
    return false;
  }

  toStr() { return this.#str; }

  monthByName$(name)
  {
    if (this.monthsByName$ == null) {
      const map = {};
      for (let i=0; i<Month.vals().size(); ++i)
      {
        const m = Month.vals().get(i);
        map[Str.lower(m.abbr$(this))] = m;
        map[Str.lower(m.full$(this))] = m;
      }
      this.monthsByName$ = map;
    }
    return this.monthsByName$[name];
  }

  numSymbols$() {
    if (this.numSymbols$ == null) {
      const pod = Pod.find("sys");
      const env = Env.cur();

      this.numSymbols$ =
      {
        decimal:  env.locale(pod, "numDecimal",  ".",    this),
        grouping: env.locale(pod, "numGrouping", ",",    this),
        minus:    env.locale(pod, "numMinus",    "-" ,   this),
        percent:  env.locale(pod, "numPercent",  "%",    this),
        posInf:   env.locale(pod, "numPosInf",   "+Inf", this),
        negInf:   env.locale(pod, "numNegInf",   "-Inf", this),
        nan:      env.locale(pod, "numNaN",      "NaN",  this)
      };
    }
    return this.numSymbols$;
  }
}