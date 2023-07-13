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
    c.jsFiles?.each |f| {
      // we expect ES javascript files in es/ directory
      natives[f.name] = f.parent.parent.plus(`es/${f.name}`)
    }

    // find types to emit
    c.types.findAll { isJsType(it) }.each { types.add(JsType(plugin, it)) }
  }

  private PodDef pod
  private JsType[] types := [,]
  private [Str:File] natives := [:]
  private [Str:Bool] peers := [:]{ it.def = false }

//////////////////////////////////////////////////////////////////////////
// JsPod
//////////////////////////////////////////////////////////////////////////

  override Void write()
  {
    writeImports
    writeTypes
    writeTypeInfo
    writeProps
    // TODO:FIXIT
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
      // js.wl("import * as ${depend.name} from './${depend.name}.js';")
      if (Pod.find(depend.name).file(`/esm/${depend.name}.js`, false) != null)
        js.wl("import * as ${depend.name} from './${depend.name}.js';")
      else
      {
        // TODO: FIXIT - non-js dependencies that will only be there in node env
        // but not the browser. Maybe the browser should return empty export in
        // this case? or we could put a comment on the same line that we
        // could search for and strip out before serving the js in the browser.
        // js.wl("let ${depend.name};")
        // await import('./esm/testSys.js').then(obj => testSys = obj).catch(err => {});
        // js.wl("await import('./${depend.name}.js').then(obj => ${depend.name}=obj).catch(err => {});")

        js.wl("import * as ${depend.name} from './${depend.name}.js';")
      }


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
    key := "${t.name}.js"
    if (peer != null)
    {
      key = "${peer.name}Peer.js"
      this.peers[t.name] = true
    }

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
    // general use map variable
    js.wl("let m;")

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
      js.wl("${t.name}.type\$ = ${adder}('${t.name}','${base}',[${mixins}],{${facets}},${flags},${t.name});")
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

    // pod meta
    js.nl.wl("m=sys.Map.make(sys.Str.type\$,sys.Str.type\$);")
    pod.meta.each |v, k|
    {
      js.wl("m.set(${k.toCode}, ${v.toCode});")
    }
    js.wl("p.__meta(m);").nl
  }

  private static Str toFacets(FacetDef[]? facets)
  {
    facets == null ? "" : facets.join(",") |f| { "'${f.type.qname}':${f.serialize.toCode}" }
  }

  private Void writeProps()
  {
    baseDir := c.input.baseDir
    if (baseDir != null)
    {
      c.resFiles.each |file|
      {
        if (file.ext != "props") return
        uri := file.uri.relTo(baseDir.uri)
        key := "${pod.name}:${uri}"
        js.wl("m=sys.Map.make(sys.Str.type\$, sys.Str.type\$);")
        file.in.readProps.each |v,k| { js.wl("m.set(${k.toCode},${v.toCode});") }
        js.wl("sys.Env.cur().__props(${key.toCode}, m);").nl
      }
      js.nl
    }
  }

  private Void writeNatives()
  {
    natives.each |f| { js.minify(f.in) }
  }

  private Void writeExports()
  {
    js.wl("export {")
    // only export public types
    types.findAll { it.def.isPublic }.each |t| {
      js.wl("${t.name},")
      if (this.peers[t.name]) js.wl("${t.peer.name}Peer,")
    }
    js.wl("};")
  }

}