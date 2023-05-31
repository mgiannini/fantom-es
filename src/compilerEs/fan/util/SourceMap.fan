//
// Copyright (c) 2015, Brian Frank and Andy Frank
// Licensed under the Academic Free License version 3.0
//
// History:
//   02 Jul 15  Matthew Giannini  Creation
//

using compiler

class SourceMap
{

//////////////////////////////////////////////////////////////////////////
// Constructor
//////////////////////////////////////////////////////////////////////////

  new make(CompilerSupport support)
  {
    this.support = support
    this.c = support.compiler
  }

//////////////////////////////////////////////////////////////////////////
// SourceMap
//////////////////////////////////////////////////////////////////////////

  This add(Str text, Loc genLoc, Loc srcLoc, Str? name := null)
  {
    // map source
    File? source := files.getOrAdd(srcLoc.file) |->File?| { findSource(srcLoc) }
    if (source == null) return this

    // add map field
    fields.add(MapField(text, genLoc, srcLoc, name))
    return this
  }

  private File? findSource(Loc loc)
  {
    c.srcFiles?.find { it.osPath == File.os(loc.file).osPath }
  }

//////////////////////////////////////////////////////////////////////////
// Output
//////////////////////////////////////////////////////////////////////////

  Void write(Int lineCount, OutStream out := Env.cur.out)
  {
    pod := support.pod.name
    out.writeChars("{\n")
    out.writeChars("\"version\": 3,\n")
    out.writeChars("\"file\": \"${pod}.js\",\n")
    out.writeChars("\"x_fan_linecount\": $lineCount,\n")
    out.writeChars("\"sourceRoot\": \"/dev/${pod}/\",\n")
    writeSources(out)
    writeMappings(out)
    out.writeChars("}\n")
    out.flush
  }

  private Void writeSources(OutStream out)
  {
    // write sources
    out.writeChars("\"sources\": [")
    files.vals.each |file, i|
    {
      if (i > 0) out.writeChars(",")
      if (file == null) out.writeChars("null")
      else out.writeChars("\"${file.name}\"")
    }
    out.writeChars("],\n")
  }

  private Void writeMappings(OutStream out)
  {
    // map source index
    srcIdx := [Str:Int][:]
    files.keys.each |k, i| { srcIdx[k] = i }

    out.writeChars("\"mappings\": \"")
    prevFileIdx := 0
    prevSrcLine := 0
    prevSrcCol  := 0
    prevGenLine := 0
    prevGenCol  := 0
    MapField? prevField
    fields.each |MapField f, Int i|
    {
      fileIdx := srcIdx[f.srcLoc.file]
      genLine := f.genLoc.line
      genCol  := f.genLoc.col
      srcLine := f.srcLine
      srcCol  := f.srcCol
      if (genLine < prevGenLine) throw Err("${f} is before line ${prevGenLine}")

      // handle missing/blank lines
      if (genLine != prevGenLine)
      {
        prevGenCol = 0
        while (genLine != prevGenLine)
        {
          out.writeChar(';')
          ++prevGenLine
        }
      }
      else
      {
        if (i > 0)
        {
          if (genCol <= prevGenCol) throw Err("${genCol} is before col ${prevGenCol}")
          out.writeChar(',')
        }
      }

      // calculate diffs
      genColDiff  := genCol - prevGenCol
      fileDiff    := fileIdx - prevFileIdx
      srcLineDiff := srcLine - prevSrcLine
      srcColDiff  := srcCol - prevSrcCol

      // write segment field
      out.writeChars(Base64VLQ.encode(genColDiff))
         .writeChars(Base64VLQ.encode(fileDiff))
         .writeChars(Base64VLQ.encode(srcLineDiff))
         .writeChars(Base64VLQ.encode(srcColDiff))

      // update prev state
      prevGenCol  = genCol
      prevFileIdx = fileIdx
      prevSrcLine = srcLine
      prevSrcCol  = srcCol
    }
    out.writeChars(";\"\n")
  }

//////////////////////////////////////////////////////////////////////////
// Pack
//////////////////////////////////////////////////////////////////////////

  ** Compile a list of pod JavaScript files into a single unified source
  ** map file.  The list of files passed to this method should match
  ** exactly the list of files used to create the corresponding JavaScript
  ** FilePack.  If the file is the standard pod JS file, then we will include
  ** an offset version of "{pod}.js.map" generated by the JavaScript compiler.
  ** Otherwise if the file is another JavaScript file (such as units.js) then
  ** we just add the appropiate offset.
  **
  ** The 'sourceRoot' option may be passed in to replace "/dev/{podName}"
  ** as the root URI used to fetch source files from the server.
  static Void pack(File[] files, OutStream out, [Str:Obj]? options := null)
  {
    // options
    sourceRoot := options?.get("sourceRoot") as Str

    // open compound source map file
    out.printLine("{")
       .printLine("\"version\": 3,")
       .printLine("\"sections\": [")

    // process each file
    curOffset := 0
    files.each |file, i|
    {
      // check if file is within a pod
      uri := file.uri
      pod := uri.scheme == "fan" ? Pod.find(uri.host, false) : null

      // check if this standard pod JS file
      Str? json := null
      if (pod != null && isPodJsFile(file))
      {
        // lookup sourcemap for the pod
        sm := pod.file(`/${pod.name}.js.map`, false)
        if (sm != null)
        {
          // read into memory
          json = sm.readAllStr

          // apply options
          if (sourceRoot != null) json = setSourceRoot(json, sourceRoot+pod.name)

        }
      }

      // read number of lines from JSON if we can, otherwise count them
      // echo("-- $uri.name  " + readNumLinesFromJson(json) + " ?= " + readNumLinesByCounting(file))
      numLines := readNumLinesFromJson(json) ?: readNumLinesByCounting(file)

      // if we have raw js file, then generate a synthetic sourcemap
      if (json == null)
      {
        mappings := StrBuf().add("AAAA;")
        buf := StrBuf()
        buf.add("""{
                   "version":3,
                   "file": "core.js",
                   "sources": ["${file.name}"],
                   """)
        if (pod != null) buf.add("\"sourceRoot\": \"").add(sourceRoot ?: "/dev/").add(pod.name).add("/\",\n")
        buf.add(Str<|"mappings": "AAAA;|>)
        (numLines+1).times |x| { buf.add("AACA;") }
        buf.add("\"}")
        json = buf.toStr
      }

      // add offset section and insert original JSON
      out.print(Str<|{"offset": {"line":|>)
         .print(curOffset)
         .print(Str<|, "column":0}, "map":|>)
         .print(json)
         .print("}")
      if (i+1 < files.size) out.printLine(",")  // cannot have trailing comma


      // advance curOffset
      curOffset += numLines
    }

    // close file
    out.printLine("]")
       .printLine("}")
  }

  ** Return if the file is the standard compilerJs pod transpiled source
  private static Bool isPodJsFile(File f)
  {
    f.uri.scheme == "fan" && f.uri.pathStr == "/${f.uri.host}.js"
  }

  ** Try to parse "x_fan_linecount" key from JSON contents
  private static Int? readNumLinesFromJson(Str? json)
  {
    r := findKeyValRange(json, Str<|"x_fan_linecount":|>)
    if (r == null) return null
    return json.getRange(r).toInt(10, false)
  }

  ** Fallback is to read each line to determine line count
  private static Int readNumLinesByCounting(File file)
  {
    num := 0
    file.eachLine { ++num }
    return num
  }

  ** Set source root option
  private static Str setSourceRoot(Str json, Str sourceRoot)
  {
    r := findKeyValRange(json, Str<|"sourceRoot":|>)
    if (r == null) return json
    return json[0..<r.start] + sourceRoot.toCode + json[r.end..-1]
  }

  ** Find key value range from JSON using simple string search
  private static Range? findKeyValRange(Str? json, Str key)
  {
    if (json == null) return null

    keyi := json.index(key)
    if (keyi == null) return null

    start := keyi + key.size
    if (json[start] == ' ') start++

    comma := json.index(",", start+1)
    if (comma == null) return null

    return start ..< comma
  }

//////////////////////////////////////////////////////////////////////////
// Fields
//////////////////////////////////////////////////////////////////////////

  private CompilerSupport support
  private Compiler c
  private [Str:File?] files := [Str:File][:] { ordered = true }
  private MapField[] fields := [,]
}

class MapField
{
  new make(Str text, Loc genLoc, Loc srcLoc, Str? name)
  {
    this.text = text
    this.genLoc = genLoc
    this.srcLoc = srcLoc
    this.name = name
  }

  ** zero-indexed line from original source file
  Int srcLine() { srcLoc.line - 1 }
  ** zero-indexed column from original source file
  Int srcCol() { srcLoc.col - 1 }

  override Str toStr()
  {
    "${fname}
        $srcLine, $srcCol
        $genLoc.line, $genLoc.col
        $text
     "
  }

  Str fname()
  {
    i := srcLoc.file.indexr("/")
    return srcLoc.file[i+1..-1]
  }

  Str text
  Loc genLoc
  Loc srcLoc
  Str? name
}