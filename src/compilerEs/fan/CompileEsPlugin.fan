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
  }

  private StrBuf buf := StrBuf()
  SourceMap sourcemap { private set }
  JsWriter js { private set }

//////////////////////////////////////////////////////////////////////////
// Emit State
//////////////////////////////////////////////////////////////////////////

  ** The variable name that refers to "this" in the current method context
  Str thisName := "this"

//////////////////////////////////////////////////////////////////////////
// Pipeline
//////////////////////////////////////////////////////////////////////////

  override Void run()
  {
    if (pod.name != "testEs") return
    log.info("CompileES: ${pod.name}")
    log.info("${compiler.pod.depends}")

try {
    JsPod(this).write
echo(buf.toStr)
    compiler.es = buf.toStr
} catch (Err e) { echo(buf.toStr); throw e }

    buf.clear
    sourcemap.write(js.line, buf.out)
// echo(buf.toStr)
    compiler.esSourceMap = buf.toStr
  }
}