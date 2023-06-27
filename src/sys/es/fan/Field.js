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

  // TODO:FIXIT:MAJOR - i think a lot of the get/set reflection is wrong
  // because we are now generating overloaded <fieldName>(it=undefined) pattern

//////////////////////////////////////////////////////////////////////////
// Factories
//////////////////////////////////////////////////////////////////////////

  static makeSetFunc(map) {
    // TODO:FIXIT - return a closure that does this
    throw Err.make("TODO:FIXIT");
    /*
    return fan.sys.Func.make(
      fan.sys.List.make(fan.sys.Param.type$),
      fan.sys.Void.type$,
      function(obj)
      {
        var keys = map.keys();
        for (var i=0; i<keys.size(); i++)
        {
          var field = keys.get(i);
          var val = map.get(field);
          field.set(obj, val, false); //, obj != inCtor);
        }
      });
      */
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
      if (this.isEnum()) {
        // const e = `${this.parent().name$()}.${this.name$()}()`;
        return eval(`${this.parent().name$()}.${this.name$()}()`);
      }
      else
        return eval(`${this.parent().name$()}.${this.name$()}()`);
    }
    else {
      throw Err.make("TODO:FIXIT get this non-static slot")
    }
    /*
    if (this.isStatic()) {
      return eval(this.#qname$());
    }
    else
    {
      var target = instance;
      if ((this.m_flags & fan.sys.FConst.Native) != 0)
        target = instance.peer;
      var getter = target[this.m_$name];
      if (getter != null)
        return getter.call(target);
      else
        return target["m_"+this.m_$name]
    }
    */
  }

  set(instance, value, checkConst=true) {
    throw Err.make("TODO:FIXIT");
    /*
    // check const
    if ((this.m_flags & fan.sys.FConst.Const) != 0)
    {
      if (checkConst)
        throw fan.sys.ReadonlyErr.make("Cannot set const field " + this.m_qname);
      else if (value != null && !fan.sys.ObjUtil.isImmutable(value))
        throw fan.sys.ReadonlyErr.make("Cannot set const field " + this.m_qname + " with mutable value");
    }

    // check static
    if ((this.m_flags & fan.sys.FConst.Static) != 0) // && !parent.isJava())
      throw fan.sys.ReadonlyErr.make("Cannot set static field " + this.m_qname);

    // check type
    if (value != null && !fan.sys.ObjUtil.typeof$(value).is(this.m_type.toNonNullable()))
      throw fan.sys.ArgErr.make("Wrong type for field " + this.m_qname + ": " + this.m_type + " != " + fan.sys.ObjUtil.typeof$(value));

    // TODO
    //if (setter != null)
    //{
    //  setter.invoke(instance, new Object[] { value });
    //  return;
    //}

    if ((this.m_flags & fan.sys.FConst.Native) != 0)
    {
      var peer = instance.peer;
      var setter = peer[this.m_$name + "$"];
      setter.call(peer, instance, value);
    }
    else
    {
      var setter = instance[this.m_$name + "$"];
      if (setter != null)
        setter.call(instance, value);
      else
        instance["m_"+this.m_$name] = value;
    }
    */
  }

}
