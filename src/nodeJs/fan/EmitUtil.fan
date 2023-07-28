//
// Copyright (c) 2023, SkyFoundry LLC
// All Rights Reserved
//
// History:
//   27 Jul 2023  Matthew Giannini  Creation
//

using compilerEs
using util

**
** Utility for emitting various JS code
**
internal class EmitUtil
{

//////////////////////////////////////////////////////////////////////////
// Constructor
//////////////////////////////////////////////////////////////////////////

  new make(NodeJsCmd cmd)
  {
    this.cmd = cmd
  }

  private NodeJsCmd cmd
  private Pod[] depends := [Pod.find("sys")]
  private File? scriptJs := null
  private ModuleSystem ms() { cmd.ms }

//////////////////////////////////////////////////////////////////////////
// Configure Dependencies
//////////////////////////////////////////////////////////////////////////

  ** Configure the pod dependencies before emitting any code
  This withDepends(Pod[] pods)
  {
    this.depends = Pod.orderByDepends(Pod.flattenDepends(pods))
    return this
  }

  ** Configure the script js for a Fantom script
  This withScript(File scriptJs)
  {
    this.scriptJs = scriptJs
    return this
  }

//////////////////////////////////////////////////////////////////////////
// Emit
//////////////////////////////////////////////////////////////////////////

  Void writePackageJson([Str:Obj?] json := [:])
  {
    if (json["name"] == null) json["name"] = "@fantom/fan"
    if (json["version"] == null) json["version"] = Pod.find("sys").version.toStr
    ms.writePackageJson(json)
  }

  ** Copy all pod js files into '<dir>/node_modules/'.
  // ** Also copies in mime.js, units.js, and indexed-props.js
  Void writeNodeModules()
  {
    writeEs6
    writeNode
    writeDepends
    writeScriptJs
    writeMimeJs
    writeUnitsJs
    // TODO: indexed-props?
  }

  ** Write 'es6.js'
  Void writeEs6()
  {
    out := ms.file("es6").out
    JsAliases(ms).write(out)
    out.flush.close
  }

  ** Write 'node.js'
  Void writeNode()
  {
    modules := ["os", "path", "fs", "crypto", "url"]
    out := ms.file("node").out
    modules.each |m, i| { ms.writeInclude(out, m) }
    ms.writeExports(out, modules).flush.close
  }

  ** Write js from configured pod dependencies
  Void writeDepends()
  {
    copyOpts  := ["overwrite": true]

    this.depends.each |pod|
    {
      script := "${pod.name}.js"
      file   := pod.file(`/${ms.moduleType}/$script`, false)
      target := ms.file(pod.name)
      if (file != null)
      {
        if (pod.name == "sys")
        {
          out := target.out
          // this is currently being written by sys/es/build.fan
          // ms.writeInclude(out, "es6.ext")
          ms.writeInclude(out, "node.ext")
          file.in.pipe(out)
          out.flush.close
        }
        else file.copyTo(target, copyOpts)
      }
    }
  }

  ** Write the fantom script if one was configured
  Void writeScriptJs()
  {
    if (scriptJs == null) return
    out := ms.file(scriptJs.basename).out
    try
    {
      scriptJs.in.pipe(out)
    }
    finally out.flush.close
  }

  ** Write the code for configuring MIME types to 'fan_mime.js'
  Void writeMimeJs()
  {
    out := ms.file("fan_mime").out
    JsExtToMime(ms).write(out)
    out.flush.close
  }

  ** Write the unit database to 'fan_units.js'
  Void writeUnitsJs()
  {
    out := ms.file("fan_units").out
    JsUnitDatabase(ms).write(out)
    out.flush.close
  }

//////////////////////////////////////////////////////////////////////////
// Str
//////////////////////////////////////////////////////////////////////////

  ** Get a Str with all the include statements for the configured
  ** dependencies that is targetted for the current module system
  ** TODO:FIXIT - we actually only support ESM right now
  Str includeStatements()
  {
    buf := StrBuf()
    this.depends.each |pod|
    {
      buf.add("import * as ${pod.name} from './${ms.moduleType}/${pod.name}.js';\n")
      if ("sys" == pod.name)
      {
        buf.add("import './${ms.moduleType}/fan_mime.js';\n")
      }
    }

    if (scriptJs != null)
      buf.add("import * as ${scriptJs.basename} from './${ms.moduleType}/${scriptJs.name}';\n")

    return buf.toStr
  }

  ** Get the JS code to configure the Env home, work and temp directories.
  Str envDirs()
  {
    buf := StrBuf()
    buf.add("  sys.Env.cur().__homeDir = sys.File.os(${Env.cur.homeDir.pathStr.toCode});\n")
    buf.add("  sys.Env.cur().__workDir = sys.File.os(${Env.cur.workDir.pathStr.toCode});\n")
    buf.add("  sys.Env.cur().__tempDir = sys.File.os(${Env.cur.tempDir.pathStr.toCode});\n")
    return buf.toStr
  }
}

**************************************************************************
** JsAliases
**************************************************************************

class JsAliases
{
  new make(ModuleSystem ms) { this.ms = ms }
  private ModuleSystem ms
  Void write(OutStream out)
  {
    out.printLine("const JsDate = Date;")
    out.printLine("const JsMap = Map;")
    out.printLine("const JsWeakMap = WeakMap;")
    out.printLine("const JsMutationObserver = typeof MutationObserver !== 'undefined' ? MutationObserver : null;")
    out.printLine("const JsEvent = (typeof Event !== 'undefined') ? Event : null;")
    out.printLine("const JsResizeObserver = (typeof ResizeObserver !== 'undefined') ? ResizeObserver : null;")
    ms.writeExports(out, ["JsDate", "JsMap", "JsWeakMap", "JsMutationObserver", "JsEvent", "JsResizeObserver"])
  }
}