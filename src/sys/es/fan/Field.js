//
// Copyright (c) 2009, Brian Frank and Andy Frank
// Licensed under the Academic Free License version 3.0
//
// History:
//   24 Mar 2009  Andy Frank  Creation
//   20 May 2009  Andy Frank  Refactor to new OO model
//   12 Apr 2023  Matthew Giannini  Refactor for ES
//

/**
 * Field.
 */
class Field extends Slot {

//////////////////////////////////////////////////////////////////////////
// Factories
//////////////////////////////////////////////////////////////////////////

  static makeSetFunc(map) {
    return (obj) => {
      const keys = map.keys();
      for (let i=0; i<keys.size(); i++)
      {
        const field = keys.get(i);
        const val   = map.get(field);
        field.set(obj, val, false); //, obj != inCtor);
      }
    }
  }

//////////////////////////////////////////////////////////////////////////
// Constructor
//////////////////////////////////////////////////////////////////////////

  constructor(parent, name, flags, type, facets) {
    super(parent, name, flags, facets);
    this.#type   = type;
    this.#name$  = this.name$$(name);
    this.#qname$ = this.parent().qname() + '.' + this.#name$;
    // TODO:FIXIT - probably don't need these (see Type.js for where these get set)
    // this.m_getter = null;
    // this.m_setter = null;
  }

  #type;
  #name$;
  #qname$;

//////////////////////////////////////////////////////////////////////////
// Internal Access
//////////////////////////////////////////////////////////////////////////

  qname$() { return this.#qname$; }

//////////////////////////////////////////////////////////////////////////
// Obj
//////////////////////////////////////////////////////////////////////////

  trap(name, args=null) {
    // private undocumented access
    if (name == "setConst") { this.set(args.get(0), args.get(1), false); return null; }
    if (name == "getter") return this.m_getter;
    if (name == "setter") return this.m_setter;
    return super.trap(name, args);
  }

//////////////////////////////////////////////////////////////////////////
// Methods
//////////////////////////////////////////////////////////////////////////

  type() { return this.#type; }

  get(instance=null) {
    if (this.isStatic()) {
      const ns = Type.$registry[this.parent().pod().name$()];
      const js = ns != null ? ns[this.parent().name$()] : null;
      if (js != null) return js[this.#name$]();
      else throw Err.make(`Failed to reflect ${this.qname$()}`);
    }
    else {
      let fname = this.#name$;
      // special handling for once fields
      if (this.isSynthetic() && fname.endsWith("$Store"))
        fname = fname.slice(-fname.length, -"$Store".length);
      return instance[fname]();
    }
  }

  set(instance, value, checkConst=true) {
    let fname = this.#name$;

    // check const
    if ((this.flags$() & FConst.Const) != 0)
    {
      if (checkConst)
        throw ReadonlyErr.make("Cannot set const field " + this.qname$());
      else if (value != null && !ObjUtil.isImmutable(value))
        throw ReadonlyErr.make("Cannot set const field " + this.qname$() + " with mutable value");
      
      // const fields have internal setter generated by the compiler
      fname = `__${fname}`;
    }

    // check static
    if ((this.flags$() & FConst.Static) != 0) // && !parent.isJava())
      throw ReadonlyErr.make("Cannot set static field " + this.qname$());

    // check type
    if (value != null && !ObjUtil.typeof$(value).is(this.type().toNonNullable()))
      throw ArgErr.make("Wrong type for field " + this.qname$() + ": " + this.type() + " != " + ObjUtil.typeof$(value));

    // TODO
    //if (setter != null)
    //{
    //  setter.invoke(instance, new Object[] { value });
    //  return;
    //}

    if ((this.flags$() & FConst.Native) != 0) {
      const peer = instance.peer;
      const setter = peer[fname];
      setter.call(peer, instance, value);
    }
    else {
      var setter = instance[fname];
      if (setter != null)
        setter.call(instance, value);
      else
        throw Err.make(`Failed to set ${this.qname$()}`);
        // instance["m_"+this.m_$name] = value;
    }
  }

}
