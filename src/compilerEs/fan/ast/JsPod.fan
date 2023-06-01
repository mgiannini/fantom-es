//
// Copyright (c) 2023, Brian Frank and Andy Frank
// Licensed under the Academic Free License version 3.0
//
// History:
//   03 May 2023  Matthew Giannini Creation
//

using compiler

**
** JsPod
**
class JsPod : JsNode
{

//////////////////////////////////////////////////////////////////////////
// Constructor
//////////////////////////////////////////////////////////////////////////

  new make(CompileEsPlugin plugin) : super(plugin)
  {
    this.pod = plugin.pod

    // map native files by name
    c.jsFiles?.each |f| { natives[f.name] = f }

    // find types to emit
    c.types.findAll { isJsType(it) }.each { types.add(JsType(plugin, it)) }
  }

  private PodDef pod
  private JsType[] types := [,]
  private [Str:File] natives := [:]


//////////////////////////////////////////////////////////////////////////
// JsPod
//////////////////////////////////////////////////////////////////////////

  override Void write()
  {
    writeImports
    writeTypes
    writeTypeInfo
    // TODO:FIXIT
    // writePodMeta
    // write properties
    // write closures?
    // write static init?
    writeNatives
    writeExports
  }

  private Void writeImports()
  {
    pod.depends.each |depend|
    {
      // NOTE if we change sys to fan we need to update JNode.qnameToJs
      js.wl("import * as ${depend.name} from './${depend.name}.js';")
      // if (depend.name == "sys")
      //   js.wl("import * as fan from './sys.js';")
      // else
      //   js.wl("import * as ${depend.name} from './${depend.name}.js")
    }
    js.nl
  }

  private Void writeTypes()
  {
    types.each |JsType t|
    {
      plugin.curType = t.def
      if (t.def.isNative) writePeer(t, null)
      else
      {
        t.write
        if (t.hasNatives) writePeer(t, t.peer)
      }
      js.nl
      plugin.curType = null
    }
  }

  private Void writePeer(JsType t, CType? peer)
  {
    key  := peer == null ? "${t.name}.js" : "${peer.name}Peer.js"
    file := natives[key]
    if (file == null)
    {
      err("Missing native impl for ${t.def.signature}", Loc("${t.name}.fan"))
    }
    else
    {
      in := file.in
      js.minify(in)
      natives.remove(key)
    }
  }

  private Void writeTypeInfo()
  {
    // add the pod to the type system
    js.wl("const p = sys.Pod.add\$('${pod.name}');")
    js.wl("const xp = sys.Param.noParams\$();")

    // filter out synthetic types from reflection
    reflect := types.findAll |t| { !t.def.isSynthetic }

    // write all types first
    reflect.each |t|
    {
      adder := t.def.isMixin ? "p.am\$" : "p.at\$"
      base  := "${t.base.pod}::${t.base.name}"
      mixins := t.mixins.join(",") |m| { "'${m.pod}::${m.name}'" }
      facets := toFacets(t.facets)
      flags  := t.def.flags
      js.wl("${t.name}.type\$ = ${adder}('${t.name}','${base}',[${mixins}],{${facets}},${flags});")
    }

    // then write slot info
    reflect.each |JsType t|
    {
      if (t.fields.isEmpty && t.methods.isEmpty) return
      js.w("${t.name}.type\$")
      t.fields.each |FieldDef f|
      {
        // don't write for FFI
        if (f.isForeign) return

        facets := toFacets(f.facets)
        js.w(".af\$('${f.name}',${f->flags},'${f.fieldType.signature}',{${facets}})")
      }
      t.methods.each |MethodDef m|
      {
        if (m.isFieldAccessor) return
        if (m.params.any |CParam p->Bool| { p.paramType.isForeign }) return
        params := m.params.join(",") |p| { "new sys.Param('${p.name}','${p.paramType.signature}',${p.hasDefault})"}
        paramList := m.params.isEmpty
          ? "xp"
          : "sys.List.make(sys.Param.type\$,[${params}])"
        facets := toFacets(m.facets)
        js.w(".am\$('${m.name}',${m.flags},'${m.ret.signature}',${paramList},{${facets}})")
      }
      js.wl(";")
    }
  }

  private static Str toFacets(FacetDef[]? facets)
  {
    facets == null ? "" : facets.join(",") |f| { "'${f.type.qname}':${f.serialize.toCode}" }
  }

  private Void writeNatives()
  {
    natives.each |f| { js.minify(f.in) }
  }

  private Void writeExports()
  {
    js.wl("export {")
    // only export public types
    types.findAll { it.def.isPublic }.each |t| { js.wl("${t.name},") }
    js.wl("};")
  }

}