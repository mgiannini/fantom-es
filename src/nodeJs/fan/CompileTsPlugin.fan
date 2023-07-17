//
// Copyright (c) 2023, Brian Frank and Andy Frank
// Licensed under the Academic Free License version 3.0
//
// History:
//   27 Apr 2023  Matthew Giannini Creation
//

using compiler
using fandoc

**
** Generate TypeScript declaration file for a pod
**
class CompileTsPlugin : CompilerStep
{
  new make(Compiler compiler) : super(compiler)
  {
  }

  override Void run()
  {
    // when you are doing save the d.ts string contents on the compile here
    //c.tsDecl = ...
  }
}