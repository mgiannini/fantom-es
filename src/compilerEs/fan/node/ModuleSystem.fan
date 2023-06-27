//
// Copyright (c) 2023, Brian Frank and Andy Frank
// Licensed under the Academic Free License version 3.0
//
// History:
//   02 May 2023  Matthew Giannini  Creation
//

abstract class ModuleSystem
{
  new make(File nodeDir)
  {
    this.nodeDir = nodeDir
  }

  const File nodeDir

  abstract Str moduleType()
  abstract File moduleDir()
  abstract Str ext()
  virtual File file(Str basename) { moduleDir.plus(`${basename}.${ext}`) }
  virtual Void writePackageJson([Str:Obj?] json)
  {
    str := Type.find("util::JsonOutStream").method("writeJsonToStr").call(json)
    nodeDir.plus(`package.json`).out.writeChars(str).flush.close
  }
  abstract OutStream writeExports(OutStream out, Str[] exports)
  OutStream writeInclude(OutStream out, Str module)
  {
    p   := module
    uri := module.toUri
    if (uri.ext != null)
    {
      module = uri.basename
      p = "./${uri.basename}.${ext}"
    }
    return doWriteInclude(out, module, p)
  }

  protected abstract OutStream doWriteInclude(OutStream out, Str module, Str path)
}

class CommonJs : ModuleSystem
{
  new make(File nodeDir) : super(nodeDir)
  {
  }

  override const Str moduleType := "cjs"
  override const File moduleDir := nodeDir.plus(`node_modules/`)
  override const Str ext := "js"
  override OutStream writeExports(OutStream out, Str[] exports)
  {
    out.print("module.exports = {")
    exports.each |export| { out.print("${export},") }
    return out.printLine("};")
  }
  protected override OutStream doWriteInclude(OutStream out, Str module, Str path)
  {
    out.printLine("const ${module} = require('${path}');")
  }
}

class Esm : ModuleSystem
{
  new make(File nodeDir) : super(nodeDir)
  {
  }

  override const Str moduleType := "esm"
  override const File moduleDir := nodeDir.plus(`esm/`)
  override const Str ext := "js"
  override Void writePackageJson([Str:Obj?] json)
  {
    json["type"] = "module"
    super.writePackageJson(json)
  }
  override OutStream writeExports(OutStream out, Str[] exports)
  {
    out.print("export {")
    exports.each |export| { out.print("${export},") }
    return out.printLine("};")
  }
  protected override OutStream doWriteInclude(OutStream out, Str module, Str path)
  {
    out.printLine("import * as ${module} from '${path}';")
  }

}