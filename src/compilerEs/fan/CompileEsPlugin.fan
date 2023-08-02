//
// Copyright (c) 2023, Brian Frank and Andy Frank
// Licensed under the Academic Free License version 3.0
//
// History:
//   27 Apr 2023  Matthew Giannini Creation
//

using compiler

**
** Fantom source to JavaScript source compiler - this class is
** plugged into the compiler pipeline by the compiler::CompileJs step.
**
class CompileEsPlugin : CompilerStep
{

//////////////////////////////////////////////////////////////////////////
// Constructor
//////////////////////////////////////////////////////////////////////////

  new make(Compiler c) : super(c)
  {
    this.sourcemap = SourceMap(this)
    this.js = JsWriter(buf.out, sourcemap)
    pod.depends.each |depend| { dependOnNames[depend.name] = true }
  }

  private StrBuf buf := StrBuf()
  SourceMap sourcemap { private set }
  JsWriter js { private set }

//////////////////////////////////////////////////////////////////////////
// Emit State
//////////////////////////////////////////////////////////////////////////

  ** The variable name that refers to "this" in the current method context
  Str thisName := "this"

  ** next unique id
  private Int uid := 0
  Int nextUid() { uid++; }

  [Str:Bool] dependOnNames := [:] { def = false }


//////////////////////////////////////////////////////////////////////////
// Pipeline
//////////////////////////////////////////////////////////////////////////

  override Void run()
  {
    if (pod.name.contains("fwt")) return

try {
    JsPod(this).write
// echo(buf.toStr)
    compiler.cjs = buf.toStr
    compiler.esm = toEsm(compiler.cjs)

} catch (Err e) { echo(buf.toStr); throw e }

    buf.clear
    sourcemap.write(js.line, buf.out)
// echo(buf.toStr)
    compiler.cjsSourceMap = buf.toStr
  }

//////////////////////////////////////////////////////////////////////////
// ESM
//////////////////////////////////////////////////////////////////////////

  ** Converts CommonJs emitted code to ESM
  private Str toEsm(Str cjs)
  {
    buf       := StrBuf()
    lines     := cjs.splitLines
    inRequire := false
    inExport  := false
    i := 0
    while (true)
    {
      line := lines[i++]
      buf.add("${line}\n")
      if (line.startsWith("// cjs require begin")) i = requireToImport(buf, lines, i)
      else if (line.startsWith("// cjs exports begin"))
      {
        // we assume this is the very last thing in the file and stop once
        // we convert to ESM export statement
        toExports(buf, lines, i)
        break
      }
    }
    return buf.toStr
  }

  private Int requireToImport(StrBuf buf, Str[] lines, Int i)
  {
    regex := Regex<|^const ([^_].*)? =.*|>

    while (true)
    {
      line := lines[i++]
      m := regex.matcher(line)
      if (m.matches)
      {
        pod := m.group(1)
        if (pod == "fan") { buf.addChar('\n'); continue; }
        buf.add("import * as ${pod} from './${pod}.js'\n")
      }
      else if (line.startsWith("// cjs require end")) { buf.add("${line}\n"); break }
      else buf.addChar('\n')
    }
    return i
  }

  private Int toExports(StrBuf buf, Str[] lines, Int i)
  {
    // skip: const <pod> = {
    line := lines[i++]

    buf.add("export {\n")
    while(true)
    {
      line = lines[i++]
      buf.add("${line}\n")
      if (line == "};") break
    }
    while (!(line = lines[i++]).startsWith("// cjs exports end")) continue;

    return i
  }
}