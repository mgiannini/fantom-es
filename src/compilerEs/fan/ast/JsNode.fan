//
// Copyright (c) 2023, Brian Frank and Andy Frank
// Licensed under the Academic Free License version 3.0
//
// History:
//   03 May 2023  Matthew Giannini Creation
//

using compiler

**
** JsNode
**
abstract class JsNode
{
  new make(CompileEsPlugin plugin, Node? node := null)
  {
    this.plugin = plugin
    this.nodeRef = node
  }

  CompileEsPlugin plugin { private set }
  Compiler c() { plugin.compiler }
  private Node? nodeRef

  virtual Node? node() { nodeRef }
  virtual Loc? loc() { node?.loc }
  static Loc? toLoc(Obj obj) { obj is Node ? ((Node)obj).loc : null }

  abstract Void write()

  JsWriter js() { plugin.js }

//////////////////////////////////////////////////////////////////////////
// Type Utils
//////////////////////////////////////////////////////////////////////////

  Bool isJsType(TypeDef def)
  {
    // we inline closures directly, so no need to generate anonymous types
    if (def.isClosure) return false

    // TODO:FIXIT: do we still need this?
    if (def.qname.contains("\$Cvars"))
    {
      echo("WARN: Cvar class: ${def.qname}")
      return false
    }

    // check for @Js facet or if forced generation
    return def.hasFacet("sys::Js") || c.input.forceJs
  }

  Bool checkJsSafety(CType ctype, Loc? loc)
  {
    if (ctype is TypeRef) return checkJsSafety(ctype->t, loc)
    else if (ctype is NullableType) return checkJsSafety(ctype->root, loc)
    else if (ctype is ListType) return checkJsSafety(ctype->v, loc)
    else if (ctype is MapType)
    {
      return checkJsSafety(ctype->k, loc) && checkJsSafety(ctype->v, loc)
    }
    else if (ctype is FuncType)
    {
      safe := true
      ft := (FuncType)ctype
      ft.params.each |param| { safe = safe && checkJsSafety(param, loc) }
      safe = safe && checkJsSafety(ft.ret, loc)
      return safe
    }
    else if (!(ctype.pod.name == "sys" || ctype.isSynthetic || ctype.facet("sys::Js") != null || c.input.forceJs))
    {
      warn("Type '${ctype.qname}' not available in JS", loc)
      return false
    }
    return true
  }

//////////////////////////////////////////////////////////////////////////
// Method Utils
//////////////////////////////////////////////////////////////////////////

  ** generates '(p1, p2, ...pn)'
  Str methodParams(CParam[] params)
  {
    buf := StrBuf().addChar('(')
    params.each |param, i|
    {
      if (i > 0) buf.addChar(',')
      buf.add(nameToJs(param.name))
    }
    return buf.addChar(')').toStr
  }

//////////////////////////////////////////////////////////////////////////
// Name Utils
//////////////////////////////////////////////////////////////////////////

  ** Get the module-qualified name for this CType. If the type is in the
  ** this pod, it does not need to be qualified
  Str qnameToJs(CType ctype)
  {
    podName := ctype.pod.name
    thisPod := podName == plugin.pod.name
    js := thisPod ? ctype.name : "${podName}.${ctype.name}"

    // make it so java FFI calls parse in js runtimes
    // code will parse but fail if actually invoked
    if (js.contains(".[java].")) js = js.replace(".[java].", ".")
    else if (js.contains("[java]")) js = js.replace("[java]", "java.fail")

    return js
  }

  ** Get the name that should be used for the generated field in JS code
  static Str fieldJs(Obj name)
  {
    // if (name is Str) return "_${name}\$"
    if (name is Str) return "#${name}"
    if (name is Field) return fieldJs(((Field)name).name)
    if (name is FieldDef) return fieldJs(((FieldDef)name).name)
    throw ArgErr("${name} [${name.typeof}]")
  }

  ** Return the JS variable/method/param name to use for the given Fantom name
  **
  ** Note - use fieldJs for generating field names since we have a lot of special
  ** handling for fields
  static Str nameToJs(Str name)
  {
    namePickles.get(name, name)
  }

  private static const Str:Str namePickles
  static
  {
    m := Str:Str[:]
    ["char", "const", "delete", "enum", "export", "float", "import", "in", "int",
     "interface", "let", "name", "self", "require", "typeof", "var", "with",
    ].each |name| { m[name] = "${name}\$" }
    namePickles = m.toImmutable
  }

  ** return a unique id name
  Str uniqName(Str name := "")
  {
    "\$${name}${plugin.nextUid}"
  }

//////////////////////////////////////////////////////////////////////////
// Logging
//////////////////////////////////////////////////////////////////////////

  CompilerErr err(Str msg, Loc? loc := null) { plugin.err(msg, loc) }
  CompilerErr warn(Str msg, Loc? loc := null) { plugin.warn(msg, loc) }

//////////////////////////////////////////////////////////////////////////
// General Utils
//////////////////////////////////////////////////////////////////////////

  Bool isPrimitive(CType ctype) { pmap.get(ctype.qname, false) }
  const Str:Bool pmap :=
  [
    "sys::Bool":    true,
    "sys::Decimal": true,
    "sys::Float":   true,
    "sys::Int":     true,
    "sys::Num":     true,
    "sys::Str":     true
  ]

  Void writeBlock(Block? block)
  {
    if (block == null) return
    block.stmts.each |stmt| {
      writeStmt(stmt)
      js.wl(";")
    }
  }

  Void writeStmt(Stmt? stmt)
  {
    if (stmt == null) return
    JsStmt(plugin, stmt).write
  }

  Void writeExpr(Expr? expr)
  {
    if (expr == null) return
    switch (expr.id)
    {
      // case ExprId.call:     JsCallExpr(plugin, expr).write
      // case ExprId.shortcut: JsShortcutExpr(plugin, expr).write
      default:              JsExpr(plugin, expr).write
    }
  }

  TypeDef? curType() { plugin.curType }

}