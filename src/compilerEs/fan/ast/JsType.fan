//
// Copyright (c) 2023, Brian Frank and Andy Frank
// Licensed under the Academic Free License version 3.0
//
// History:
//   03 May 2023  Matthew Giannini Creation
//

using compiler

**
** JsType
**
class JsType : JsNode
{

//////////////////////////////////////////////////////////////////////////
// Constructor
//////////////////////////////////////////////////////////////////////////

  new make(CompileEsPlugin plugin, TypeDef def) : super(plugin, def)
  {
    this.hasNatives = null != def.slots.find |n| { n.isNative && n.parent.qname == def.qname }
    this.peer = findPeer(plugin, def)
    // TODO: other things like static init, instance init, methods
  }

  static CType? findPeer(CompileEsPlugin plugin, CType def)
  {
    CType? t := def
    while (t != null)
    {
      slot := t.slots.find |s| { s.isNative && s.parent.qname == t.qname }
      if (slot != null) return slot.parent
      t = t.base
    }
    return null
  }

  override TypeDef? node() { super.node }

  ** Does this type have any native slots directly
  const Bool hasNatives

  ** Compiler peer type if it has one
  CType? peer { private set }

  ** Compiler TypeDef
  TypeDef def() { this.node }

  ** Compiler name for the type
  Str name() { def.name }

  ** Compiler base type
  CType base() { def.base }

  ** Facets for this type
  FacetDef[] facets() { def.facets ?: FacetDef[,] }

  ** Mixins for this type
  CType[] mixins() { def.mixins }

  ** Fields
  FieldDef[] fields() { def.fieldDefs }

  once FieldDef[] enumFields()
  {
    fields.findAll { it.enumDef != null }.sort |a,b| { a.enumDef.ordinal <=> b.enumDef.ordinal }
  }

  ** Methods (excluding instanceInit)
  once MethodDef[] methods() { def.methodDefs.findAll |m| { !m.isInstanceInit } }

  ** Get the instanceInit method if one is defined
  once MethodDef? instanceInit() { def.methodDefs.find |m| { m.isInstanceInit } }

  override Str toStr() { def.signature }

//////////////////////////////////////////////////////////////////////////
// Write
//////////////////////////////////////////////////////////////////////////

  override Void write()
  {
    // class/mixin - note mixins do not extend Obj
    if (def.isMixin)
      js.wl("class ${name} {", loc)
    else
      js.wl("class ${name} extends ${qnameToJs(base)} {", loc)

    js.indent

    writeCtor
    if (!def.isSynthetic) js.wl("typeof\$() { return ${name}.type\$; }", loc).nl
    mixins.each |m| { copyMixin(m) }

    // slots
    fields.each |f| { writeField(f) }
    methods.each |m| { writeMethod(m) }

    js.unindent
    js.wl("}")
  }

  private Void copyMixin(CType ref)
  {
    ref.slots.each |CSlot slot|
    {
      if (slot.parent.isObj) return
      if (slot.isAbstract) return
      if (slot.isStatic) return

      if (!slot.isPrivate)
      {
        // check if this mixin's slot was resolved by the compiler as the
        // implementation for the corresponding slot on this JsType
        resolved := def.slots.find { it.qname == slot.qname }
        if (resolved == null) return
      }

      // use mixin implementation (hijack it from the parent type's prototype)
      slotName := nameToJs(slot.name)
      js.wl("${slotName} = ${qnameToJs(slot.parent)}.prototype.${slotName};").nl
    }
  }

  private Void writeCtor()
  {
    js.wl("constructor() {", loc)
    js.indent
    if (!def.isMixin) js.wl("super();")
    if (peer != null) js.wl("this.peer = new ${qnameToJs(peer)}Peer(this);", loc)
    js.wl("const this\$ = this;", loc)
    if (instanceInit != null) writeBlock(instanceInit.code)
    js.unindent
    js.wl("}").nl
  }

//////////////////////////////////////////////////////////////////////////
// Fields
//////////////////////////////////////////////////////////////////////////

  private Void writeField(FieldDef f)
  {
    if (f.isNative) return
    if (f.isEnum)   return writeEnumField(f)

    fieldType := f.fieldType
    name      := fieldJs(f.name)
    defVal    := "null"
    if (!fieldType.isNullable)
    {
      switch (fieldType.signature)
      {
        case "sys::Bool":    defVal = "false"
        case "sys::Int":     defVal = "0"
        case "sys::Float":   defVal = "sys.Float.make(0)"
        case "sys::Decimal": defVal = "sys.Decimal.make(0)"
      }
    }

    // write field storage
    if (f.isStatic) js.w("static ")
    js.wl("${name} = ${defVal};", f.loc).nl

    // write synthetic public API for reading/writing the field
    if (f.isPrivate) return

    // skip fields with no public getter or setter
    if ((f.getter?.isPrivate ?: true) && (f.setter?.isPrivate ?: true)) return

    // use actual field name for public api
    allowSet := f.setter != null && !f.setter.isPrivate
    js.w("${nameToJs(f.name)}(", f.loc)
    if (allowSet) js.w("it=undefined")
    js.wl(") {")
    js.indent
    if (!allowSet) writeBlock(f.getter->code)
    else
    {
      js.wl("if (it === undefined) {").indent
      writeBlock(f.getter->code)
      js.unindent.wl("}")
      js.wl("else {").indent
      writeBlock(f.setter->code)
      js.unindent.wl("}")
    }
    js.unindent.wl("}").nl
  }

  private Void writeEnumField(FieldDef f)
  {
    name := nameToJs(f.name)
    ord  := f.enumDef.ordinal
    js.wl("static ${name}() { return ${qnameToJs(f.parent)}.vals().get(${ord}); }").nl
  }

//////////////////////////////////////////////////////////////////////////
// Methods
//////////////////////////////////////////////////////////////////////////

  private Void writeMethod(MethodDef m)
  {
    if (curType.isEnum)
    {
      if (m.isStaticInit) return writeEnumStaticInit(m)
      else if (m.isStatic && m.name == "fromStr") return writeEnumFromStr(m)
    }
    if (m.isStaticInit && curType.isEnum) return writeEnumStaticInit(m)

    selfJs := nameToJs("self")
    nameJs := nameToJs(m.name)
    typeJs := qnameToJs(m.parentDef)
    if (typeJs != qnameToJs(def)) throw Err("??? ${typeJs} ${qnameToJs(def)}")
    if (m.isInstanceCtor)
    {
      // write static factory make method
      ctorParams := CParam[SyntheticParam("self")].addAll(m.params)
      js.wl("static ${nameJs}${methodParams(m.params)} {", m.loc)
        .indent
        .wl("const ${selfJs} = new ${typeJs}();")
        .wl("${typeJs}.${nameJs}\$${methodParams(ctorParams)};")
        .wl("return ${selfJs};")
        .unindent
        .wl("}").nl

      // write factory make$ method
      try
      {
        plugin.thisName = selfJs
        doWriteMethod(m, "${nameJs}\$", ctorParams)
      }
      finally plugin.thisName = "this"
    }
    else if (m.isGetter || m.isSetter)
    {
      // getters and setters are synthetically generated when we emit
      // the field (see writeField)
      return
    }
    else doWriteMethod(m)
    js.nl
  }

  private Void doWriteMethod(MethodDef m, Str methName := nameToJs(m.name), CParam[] methParams := m.params)
  {
    // skip abstract methods
    if (m.isAbstract) return

    if (m.isStatic || m.isInstanceCtor) js.w("static ")
    js.wl("${methName}${methodParams(methParams)} {", m.loc)
    js.indent

    // default parameters
    methParams.each |param|
    {
      if (!param.hasDefault) return
      nameJs := nameToJs(param.name)
      js.w("if (${nameJs} === undefined) ${nameJs} = ", toLoc(param))
      JsExpr(plugin, param->def).write
      js.wl(";")
    }

    // closure support
    // TODO:TEST - need to make sure that code using "this$" works
    hasClosure := ClosureFinder(m).exists
    if (hasClosure) js.wl("const this\$ = ${plugin.thisName}")

    if (m.isNative)
    {
      if (m.isStatic)
      {
        js.wl("return ${qnameToJs(peer)}Peer.${methName}${methodParams(methParams)};", m.loc)
      }
      else
      {
        pars := [SyntheticParam("this")].addAll(methParams)
        js.wl("return this.peer.${methName}${methodParams(pars)};", m.loc)
      }
    }
    else
    {
      // ctor chaining
      if (m.ctorChain != null)
      {
        JsExpr(plugin, m.ctorChain).write
        js.wl(";")
      }

      // method body
      writeBlock(m.code)
    }

    js.unindent
    js.wl("}")
  }

  ** An enum static$init method is used to initialize the enum vals.
  ** We handle that by doing it lazily so that we don't run into
  ** static init ordering issues.
  private Void writeEnumStaticInit(MethodDef m)
  {
    enumName  := qnameToJs(m.parent)
    valsField := "${enumName}.#vals"

    js.wl("static vals() {", m.loc).indent
    js.wl("if (${valsField} == null) {").indent

    js.wl("${valsField} = sys.List.make(${enumName}.type\$, [").indent
    enumFields.each |FieldDef f, Int i| {
      def := f.enumDef
      if (def.ctorArgs.size > 0) throw Err("TODO:FIXIT - ctorArgs for enum")
      js.wl("${enumName}.make(${def.ordinal},${def.name.toCode}),")
      // def.ctorArgs.each |Expr arg, Int j| {
      //   if (j > 0) js.w(", ")
      //   writeExpr(arg)
      // }
      // js.wl("),")
    }
    js.unindent.wl("]).toImmutable();")

    js.unindent.wl("}")
    js.wl("return ${valsField};")
    js.unindent.wl("}").nl
  }

  private Void writeEnumFromStr(MethodDef m)
  {
    typeName := qnameToJs(m.parent)
    js.w("static ").w("fromStr(name\$, checked=true)", m.loc).wl(" {").indent
    js.wl("return sys.Enum.doFromStr(${typeName}.type\$, ${typeName}.vals(), name\$, checked);")
    js.unindent.wl("}").nl
  }

}

**************************************************************************
** SyntheticParam
**************************************************************************

internal class SyntheticParam : CParam
{
  new make(Str name) { this.name = name }
  override const Str name
  override CType paramType() { throw UnsupportedErr() }
  override const Bool hasDefault := false
}

**************************************************************************
** ClosureFinder
**************************************************************************

internal class ClosureFinder : Visitor
{
  new make(Node node) { this.node = node }
  Node node { private set }
  Bool found := false
  Bool exists()
  {
    node->walk(this, VisitDepth.expr)
    return found
  }
  override Expr visitExpr(Expr expr)
  {
    if (expr is ClosureExpr) found = true
    return Visitor.super.visitExpr(expr)
  }
}
