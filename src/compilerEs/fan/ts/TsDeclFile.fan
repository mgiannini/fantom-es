//
// Copyright (c) 2023, Brian Frank and Andy Frank
// Licensed under the Academic Free License version 3.0
//
// History:
//   31 May 2023  Matthew Giannini Creation
//

using compiler

**
** Generate the TypeScript declaration file for a pod
**
class TsDeclFile
{
  new make(OutStream out)
  {
    this.out = out
  }

  private OutStream out
  private Type jsFacet := Type.find("sys::Js")

  Void writePod(Pod pod)
  {
echo("TODO: write t.ds for $pod")
    // write any top-level d.ts stuff
    // ...

    // write declaration for each type
    pod.types.findAll { !it.isSynthetic }.each |type|
    {
      // TODO: for now generate declaration for all types regardless of whether
      // they have the @Js facet or not
      // if (!type.hasFacet(jsFacet)) return
echo("  $type")
    }
  }

}

/*
// TODO:MAYBE - decided not to make this part of the compiler pipeline for now
// because how would we generate for sys?
class TsDeclFile : JsNode
{
  new make(CompileEsPlugin plugin) : super(plugin)
  {
    this.pod = plugin.pod
  }

  private PodDef pod

  override Void write()
  {
    js.wl("// I am going to be a TypeScript declaration file")
    c.types.findAll { isJsType(it) }.each { writeType(it) }
  }

  private Void writeType(TypeDef def)
  {
    js.wl("// TODO: ${def.qname}")
  }
}
*/