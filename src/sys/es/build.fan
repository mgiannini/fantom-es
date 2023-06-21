#! /usr/bin/env fansubstitute
//
// Copyright (c) 2023, Brian Frank and Andy Frank
// Licensed under the Academic Free License version 3.0
//
// History:
//   30 Mar 2023  Matthew Giannini  Creation
//

using build
using compiler
// using compilerJs

class Build : BuildScript
{

//////////////////////////////////////////////////////////////////////////
// Fields
//////////////////////////////////////////////////////////////////////////

  SysPipeline[] pipelines := [SysPipeline.makeEsm(this), SysPipeline.makeCjs(this) ]

//////////////////////////////////////////////////////////////////////////
// Compile
//////////////////////////////////////////////////////////////////////////

  @Target { help = "Compile javascript for sys pod" }
  Void compile()
  {
    pipelines.each |p| { p.compile }
  }

//////////////////////////////////////////////////////////////////////////
// Clean
//////////////////////////////////////////////////////////////////////////

  @Target { help = "Delete all intermediate and target files" }
  Void clean()
  {
    pipelines.each |p| { p.clean }
  }

//////////////////////////////////////////////////////////////////////////
// Full
//////////////////////////////////////////////////////////////////////////

  @Target { help = "Run clean, compile" }
  Void full()
  {
    clean
    compile
  }
}

**************************************************************************
** SysPipeline
**************************************************************************

@NoDoc class SysPipeline
{
  static new makeCjs(Build build) { return SysPipeline(build, "cjs") }
  static new makeEsm(Build build) { return SysPipeline(build, "esm") }

  private new make(Build build, Str format)
  {
    this.build = build
    this.format = format
    log.level = LogLevel.debug

    this.etc     = scriptFile.parent.parent.parent.parent + `etc/`
    this.sys     = scriptFile.parent + `fan/`
    this.fanx    = scriptFile.parent + `fanx/`
    this.tempDir = scriptFile.parent + `temp-${format}/`
  }

  private Build build
  private const Str format

  private const File etc
  private const File sys
  private const File fanx
  private const File tempDir

  private OutStream? out       // init
  private CType[]? types       // resolveSysTypes
  private Str:CType typesByName := [:]
  private Str[] exports := [,]

  private File scriptFile() { build.scriptFile }
  private BuildLog log() { build.log }

//////////////////////////////////////////////////////////////////////////
// Compile
//////////////////////////////////////////////////////////////////////////

  Void compile()
  {
    log.info("compile [${format}]")
    log.indent
    try
    {
      init
      resolveSysTypes
      writeSys
      writeFanx
      writeTypeInfo
      writeSysSupport
      log.warn("TODO: SysProps")
      log.warn("TODO: PodMeta")
      writeExports
      finish
    }
    finally { log.unindent }
  }

  private Void init()
  {
    tempDir.delete
    tempDir.create
    // for now always use js ext regardless of format
    this.out = tempDir.createFile("${format}/sys.js").out
  }

  private Void resolveSysTypes()
  {
    lib := build.devHomeDir + `lib/fan/`
    ns := FPodNamespace(lib)
    this.types = ns.sysPod.types
    types.each |t| { typesByName[t.name] = t }
  }

  private Void writeSys()
  {
    log.debug("fan/")
    types.each |t|
    {
      f := sys + `${t.name}.js`
      if (!f.exists) return
      append(f, out)
    }
    append(sys + `Sys.js`, out)
    append(sys + `Facets.js`, out)
    log.warn("TODO: append MethodFunc.js")
    // append(sys + `MethodFunc.js`, out)
  }

  private Void writeFanx()
  {
    log.debug("fanx/")
    fanx.listFiles.each |f| { append(f, out) }
  }

  private Void writeTypeInfo()
  {
    log.debug("TypeInfo")
    log.indent

    // add the pod
    out.printLine("const p = Pod.add\$('sys');")

    // filter out synthetic types from reflection
    errType   := types.find |t| { t.qname == "sys::Err" }
    facetType := types.find |t| { t.qname == "sys::Facet" }
    reflect   := types.findAll |t|
    {
      if (t.isSynthetic) return false
      if (t.fits(errType)) return true
      if (t.fits(facetType)) return true
      return (sys+`${t.name}.js`).exists
    }

    // Obj and Type must be defined first
    i := reflect.findIndex |t| { t.qname == "sys::Type" }
    reflect.insert(1, reflect.removeAt(i))

    // write all types first
    reflect.each |FType t|
    {
      log.debug("$t")
      // make sure type is loaded
      t.slots

      adder  := t.isMixin ? "p.am\$" :  "p.at\$"
      base   := t.base == null ? "null" : "'${t.base.qname}'"
      mixins := t.mixins.join(",") |m| { "'${m.pod}::${m.name}'" }
      facets := toFacets(t->ffacets)
      flags  := t->flags
      out.printLine("${t.name}.type\$ = ${adder}('${t.name}',${base},[${mixins}],{${facets}},${flags},${t.name});")
      switch (t.name)
      {
        case "Func":
        case "List":
        case "Map":
          // these have custom typeof$() implementations
          ignore := true
        default:
          // otherwise autogenerate the typeof$() method on the type's prototype
          out.printLine("${t.name}.prototype.typeof\$ = () => { return ${t.name}.type\$; }")
      }

      // init generic types after Type
      if (t.name == "Type") out.printLine("Sys.initGenericParamTypes();")
    }

    // then write slot info
    reflect.each |t|
    {
      if (t.fields.isEmpty && t.methods.isEmpty) return
      out.print("${t.name}.type\$")
      t.fields.each |f|
      {
        facets := toFacets(f->ffacets)
        out.print(".af\$('${f.name}',${f->flags},'${f.fieldType.signature}',{${facets}})")
      }
      t.methods.each |m|
      {
        facets := toFacets(m->ffacets)
        params := StrBuf().add("List.make(Param.type\$,[")
        m.params.each |p,j|
        {
          if (j > 0) params.add(",")
          params.add("new Param('${p.name}','${p.paramType.signature}',${p.hasDefault})")
        }
        params.add("])")
        out.print(".am\$('${m.name}',${m->flags},'${m.returnType.signature}',${params},{${facets}})")
      }
      out.printLine(";")
    }

    log.unindent
  }

  private static Str toFacets(FFacet[]? facets)
  {
    facets == null ? "" : facets.join(",") |f| { "'${f.qname}':${f.val.toCode}" }
  }

  private Void writeSysSupport()
  {
    log.debug("fan/ [support] [TODO:FIXIT]")
    append(sys + `FConst.js`, out)
    append(sys + `Crypto.js`, out)
    // append(sys + `MemBufStream.js`, out)
    // append(sys + `Md5.js`, out)
    append(sys + `ObjUtil.js`, out)
    // append(sys + `Sha1.js`, out)
    // append(sys + `Sha256.js`, out)
    append(sys + `StrInStream.js`, out)
    append(sys + `StrBufOutStream.js`, out)
    append(sys + `DateTimeStr.js`, out)
    // // use expclit ; to avoid parser bugs with tz func wrapper
    // out.print(";"); (etc + `sys/tz.js`).in.pipe(out)
    append(sys + `staticInit.js`, out)
  }

  private Void writeExports()
  {
    sb := StrBuf()
    switch (format)
    {
      case "esm": sb.add("export {\n")
      case "cjs": sb.add("module.exports = {\n")
      default: throw UnsupportedErr("${format}")
    }
    exports.each |t,i| { sb.add("${t},\n") }
    out.printLine(sb.add("};").toStr)
  }

  private Void finish()
  {
    out.flush.close
    this.out = null

    // close sys.pod FPod.zip to release lock so we can rejar that file
    types.first.pod->zip->close

    // add into pod file
    jar := JdkTask.make(build).jarExe
    pod := build.devHomeDir + `lib/fan/sys.pod`
    Exec.make(build, [jar, "fu", pod.osPath, "-C", tempDir.osPath, "."], tempDir).run

    tempDir.delete
  }

//////////////////////////////////////////////////////////////////////////
// Clean
//////////////////////////////////////////////////////////////////////////

  Void clean()
  {
    log.info("clean [${format}] [${tempDir}")
    Delete.make(build, tempDir).run
  }

//////////////////////////////////////////////////////////////////////////
// Support
//////////////////////////////////////////////////////////////////////////

  private static const Regex regClass := Regex("^class (.*?)\\s+.*")
  private Void append(File f, OutStream out)
  {
    log.indent
    log.debug("$f.name")

    inBlock := false
    f.readAllLines.each |Str line|
    {
      s := line
      // line comments
      i := s.index("//")
      if (i != null)
      {
        // skip uris
        if (i==0 || s[i-1] != ':') s = s[0..<i]
      }
      // block comments
      temp := s
      a := temp.index("/*")
      if (a != null)
      {
        s = temp[0..<a]
        inBlock = true
      }
      if (inBlock)
      {
        b := temp.index("*/")
        if (b != null)
        {
          s = (a == null) ? temp[b+2..-1] : s + temp[b+2..-1]
          inBlock = false
        }
      }
      // trim and print
      s = s.trimEnd
      if (inBlock) return
      if (s.size == 0) return

      // add class definitions to exports
      m := regClass.matcher(s)
      if (m.matches)
      {
        name := m.group(1)
        if (typesByName[name] != null) {
          exports.add(name)
        } else {
          switch (name)
          {
            case "ObjUtil":
              exports.add(name)
            default:
              log.warn("class ${name} doesn't correspond to FType")
          }
        }
      }
      out.printLine(s)
    }

    log.unindent
  }
}