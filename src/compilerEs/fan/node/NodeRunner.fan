//
// Copyright (c) 2023, Brian Frank and Andy Frank
// Licensed under the Academic Free License version 3.0
//
// History:
//   31 Mar 2023  Matthew Giannini  Creation
//

using compiler
using compiler::Compiler as FanCompiler

class NodeRunner
{

//////////////////////////////////////////////////////////////////////////
// Fields
//////////////////////////////////////////////////////////////////////////

  private [Str:Str]? argsMap      // parseArgs
  File? nodeDir { private set }   // setup
  private ModuleSystem? ms        // setup
  private Pod[]? dependencies     // sortDepends, compile
  private Str? tempPod            // compile
  private Str? js                 // compile

//////////////////////////////////////////////////////////////////////////
// Main
//////////////////////////////////////////////////////////////////////////

  Int main(Str[] args := Env.cur.args)
  {
    // check for nodejs
    if (!checkForNode) return 1

    try
    {
      parseArgs(args)
      setup
      if (hasArg("help") || hasArg("h")) { help(); return 0 }
      if (hasArg("test")) doTest
      else if (hasArg("run")) doRun
      else if (isInit) doJsBootStrap
      else throw ArgErr("Invalid options")

      // cleanup
      if (!hasArg("keep") && !isInit) nodeDir.delete
    }
    catch (ArgErr e)
    {
      Env.cur.err.printLine("${e.msg}\n")
      help
      return 2
    }
    return 0
  }

  private Bool checkForNode()
  {
    cmd := ["which", "-s", "node"]
    if ("win32" == Env.cur.os) cmd = ["where", "node"]
    if (Process(cmd) { it.out = null }.run.join != 0)
    {
      Env.cur.err.printLine("Node not found")
      Env.cur.err.printLine("Please ensure Node.js is installed and available in your PATH")
      return false
    }
    return true
  }

  private Void help()
  {
    echo("NodeRunner")
    echo("Usage:")
    echo("  NodeRunner [options] -test <pod>[::<test>[.<method>]]")
    echo("  NodeRunner [options] -run <script>")
    echo("Options:")
    echo("  -keep      Keep intermediate test scripts")
  }

  private Bool isInit() { hasArg("init") }

  private Void setup()
  {
    // setup nodeDir
    this.nodeDir = Env.cur.tempDir + `nodeRunner/`
    if (hasArg("dir"))
      nodeDir = arg("dir").toUri.plusSlash.toFile
    else if (isInit)
      nodeDir = Env.cur.homeDir.plus(`lib/es/`)
    nodeDir = nodeDir.normalize

    // initialize module type
    this.ms = hasArg("cjs") ? CommonJs(nodeDir) : Esm(nodeDir)
  }

//////////////////////////////////////////////////////////////////////////
// Args
//////////////////////////////////////////////////////////////////////////

  private Bool hasArg(Str n) { argsMap.containsKey(n) }

  private Str? arg(Str n) { argsMap[n] }

  private Void parseArgs(Str[] envArgs)
  {
    this.argsMap = Str:Str[:]

    // parse command lines arg "-key [val]"
    envArgs.each |s, i|
    {
      if (!s.startsWith("-") || s.size < 2) return
      name := s[1..-1]
      val  := "true"
      if (i+1 < envArgs.size && !envArgs[i+1].startsWith("-"))
        val = envArgs[i+1]
      this.argsMap[name] = val
    }
  }

//////////////////////////////////////////////////////////////////////////
// Test
//////////////////////////////////////////////////////////////////////////

  private Void doTest()
  {
    pod    := arg("test") ?: throw ArgErr("No test specified")
    type   := "*"
    method := "*"

    // check for type
    if (pod.contains("::"))
    {
      i := pod.index("::")
      type = pod[i+2..-1]
      pod  = pod[0..i-1]
    }

    // check for method
    if (type.contains("."))
    {
      i := type.index(".")
      method = type[i+1..-1]
      type   = type[0..i-1]
    }

    p := Pod.find(pod)
    sortDepends(p)
    ms.writePackageJson(["name":"testRunner", "main":"testRunner.js"])
    writeNodeModules
    testRunner(p, type, method)
  }

  private Void testRunner(Pod pod, Str type, Str method)
  {
    template := this.typeof.pod.file(`/res/testRunnerTemplate.js`).readAllStr
    template = template.replace("//{{include}}", includeStatements)
    template = template.replace("//{{tests}}", testList(pod, type, method))
    template = template.replace("//{{envDirs}}", envDirs)

    // write test runner
    f := nodeDir.plus(`testRunner.js`)
    f.out.writeChars(template).flush.close

    // invoke node to run tests
    t1 := Duration.now
    Process(["node", "${f.normalize.osPath}"]).run.join
    t2 := Duration.now

    echo("")
    echo("Time: ${(t2-t1).toLocale}")
    echo("")
  }

  private Str envDirs()
  {
    buf := StrBuf()
    buf.add("  sys.Env.cur().__homeDir = sys.File.os(${Env.cur.homeDir.pathStr.toCode});\n")
    buf.add("  sys.Env.cur().__workDir = sys.File.os(${Env.cur.workDir.pathStr.toCode});\n")
    buf.add("  sys.Env.cur().__tempDir = sys.File.os(${Env.cur.tempDir.pathStr.toCode});\n")
    return buf.toStr
  }

  private Str testList(Pod pod, Str type, Str method)
  {
    buf := StrBuf()
    buf.add("const tests = [\n")

    types := type == "*" ? pod.types : [pod.type(type)]
    types.findAll { it.fits(Test#) && it.hasFacet(Js#) }.each |t|
    {
      buf.add("  {'type': ${pod.name}.${t.name},\n")
         .add("   'qname': '${t.qname}',\n")
         .add("   'methods': [")
      methods(t, method).each { buf.add("'${it.name}',") } ; buf.add("]\n")
      buf.add("  },\n")
    }
    return buf.add("];\n").toStr
  }

  private static Method[] methods(Type type, Str methodName)
  {
    return type.methods.findAll |Method m->Bool|
    {
      if (m.isAbstract) return false
      if (m.name.startsWith("test"))
      {
        if (methodName == "*") return true
        return methodName == m.name
      }
      return false
    }
  }

//////////////////////////////////////////////////////////////////////////
// Run
//////////////////////////////////////////////////////////////////////////

  private Void doRun()
  {
    file := arg("run").toUri.toFile
    if (!file.exists) { echo("${file} not found"); return }
    // this.js = compile(file.in.readAllStr)
    throw Err("TODO")
  }

//////////////////////////////////////////////////////////////////////////
// Js
//////////////////////////////////////////////////////////////////////////

  private Void doJsBootStrap()
  {
    this.dependencies = [Pod.find("sys")]
    writeNodeModules
    writeTzJs

    // include supporting databases
    out := ms.file("fan").out
    ["sys", "fan_mime", "fan_units"].each |m| { ms.writeInclude(out, "${m}.ext") }

    // export sys
    out.printLine("export { sys };").flush.close

    // sys.d.ts
    writeTsDecl

    echo("JS init written to: ${ms.moduleDir}")
  }

  private Void writeTsDecl()
  {
    sysDecl := ms.moduleDir.plus(`sys.d.ts`)
    sysDir  := Env.cur.homeDir.plus(`src/sys/`)
    ci      := CompilerInput()
    ci.podName    = "sys"
    ci.summary    = "synthetic sys build"
    ci.version    = Pod.find("sys").version
    ci.depends    = Depend[,]
    ci.inputLoc   = Loc.makeFile(sysDir.plus(`build.fan`))
    ci.baseDir    = sysDir
    ci.srcFiles   = [sysDir.plus(`fan/`).uri]
    ci.mode       = CompilerInputMode.file
    ci.output     = CompilerOutputMode.podFile
    ci.includeDoc = true
    c := FanCompiler(ci)
    c.frontend
    sysDecl.out.writeChars(c.tsDecl).flush.close
  }

//////////////////////////////////////////////////////////////////////////
// Dependency Graph
//////////////////////////////////////////////////////////////////////////

  private Void sortDepends(Pod p)
  {
    this.dependencies = orderDependencies(buildGraph(p))
  }

  private [Str:DigraphNode] buildGraph(Pod p, [Str:DigraphNode] graph := [Str:DigraphNode][:])
  {
    node := graph.getOrAdd(p.name) { DigraphNode(p) }
    p.depends.each |Depend d|
    {
      depPod  := Pod.find(d.name)
      depNode := graph.getOrAdd(depPod.name) { DigraphNode(depPod) }

      // connect nodes
      node.addOut(depNode.name)
      depNode.addIn(node.name)

      // recurse
      graph = buildGraph(depPod, graph)
    }
    return graph
  }

  private Pod[] orderDependencies([Str:DigraphNode] graph)
  {
    ordered := Pod[,]
    nodesWithNoIncomingEdges := DigraphNode[,]
    graph.each |node|
    {
      if (node.numIn == 0) nodesWithNoIncomingEdges.add(node)
    }
    while (!nodesWithNoIncomingEdges.isEmpty)
    {
      node := nodesWithNoIncomingEdges.pop
      ordered.add(node.pod)

      // decrement the in-degree of that node's neighbors
      node.out.each |name|
      {
        neighbor := graph[name]
        neighbor.in.remove(node.name)
        if (neighbor.numIn == 0) nodesWithNoIncomingEdges.add(neighbor)
      }
    }
    return ordered.reverse
  }

  private Bool isJsPod(Pod pod)
  {
    return pod.file(`/esm/${pod.name}.js`, false) != null
  }

//////////////////////////////////////////////////////////////////////////
// Node
//////////////////////////////////////////////////////////////////////////

  ** Copy all pod js files into <nodeDir>/node_modules
  ** Also copies in mime.js, units.js, and indexed-props.js
  private Void writeNodeModules()
  {
    writeEs6
    writeNode

    // write js from pod dependencies
    writeDependencies

    // (optional) temp pod
    // TODO: FIXIT
    // if (tempPod != null)
    //   (moduleDir + `${tempPod}.${ext}`).out.writeChars(js).flush.close

    writeMimeJs
    writeUnitsJs

    // // indexed-props
    // if (!isInit)
    // {
    //   out := (moduleDir + `indexed-props.js`).out
    //   JsIndexedProps().write(out, dependencies)
    //   out.flush.close
    // }
  }

  private Void writeEs6()
  {
    out := ms.file("es6").out
    JsAliases(ms).write(out)
    out.flush.close
  }

  private Void writeMimeJs()
  {
    out := ms.file("fan_mime").out
    JsExtToMime(ms).write(out)
    out.flush.close
  }

  private Void writeUnitsJs()
  {
    out := ms.file("fan_units").out
    JsUnitDatabase(ms).write(out)
    out.flush.close
  }

  private Void writeNode()
  {
    modules := ["os", "path", "fs", "crypto", "url"]
    out := ms.file("node").out
    modules.each |m, i| { ms.writeInclude(out, m) }
    ms.writeExports(out, modules).flush.close
  }

  private Void writeDependencies()
  {
    copyOpts  := ["overwrite": true]

    dependencies.each |pod|
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

  private Void writeTzJs()
  {
    // tz.js
    TzTool(["-silent", "-gen", "-outDir", ms.moduleDir.toStr]).run
  }

  private Str includeStatements()
  {
    buf := StrBuf()
    dependencies.each |pod|
    {
      buf.add("import * as ${pod.name} from './${ms.moduleType}/${pod.name}.js';\n")
      if ("sys" == pod.name)
      {
        buf.add("import './${ms.moduleType}/fan_mime.js';\n")
      }
    }
    // TODO:FIXIT: tempPod???
    return buf.toStr
  }

  // private Str requireStatements()
  // {
  //   buf := StrBuf()
  //   dependencies.each |pod|
  //   {
  //     if ("sys" == pod.name)
  //     {
  //       buf.add("var fan = require('${pod.name}.js');\n")
  //       buf.add("require('mime.js');\n")
  //       buf.add("require('units.js');\n")
  //       buf.add("require('indexed-props.js');\n")
  //     }
  //     else buf.add("require('${pod.name}.js');\n")
  //   }

  //   if (tempPod != null)
  //     buf.add("require('${tempPod}.js');\n")

  //   return buf.toStr
  // }


}

**************************************************************************
** Digraph Node
**************************************************************************

internal class DigraphNode
{
  new make(Pod pod) { this.pod = pod }
  const Pod pod
  Str name() { pod.name }
  Str[] in := [,]
  Str[] out := [,]
  This addIn(Str name)
  {
    if (!in.contains(name)) in.add(name)
    return this
  }
  This addOut(Str name)
  {
    if (!out.contains(name)) out.add(name)
    return this
  }
  Int numIn() { in.size }
  Int numOut() { out.size }
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