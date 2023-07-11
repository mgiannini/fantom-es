//
// Copyright (c) 2023, Brian Frank and Andy Frank
// Licensed under the Academic Free License version 3.0
//
// History:
//   31 May 2023  Matthew Giannini Creation
//

using compiler
// using fandoc

**
** Generate the TypeScript declaration file for a pod
**
class TsDeclFile
{
  new make(OutStream out)
  {
    this.out = out
    // docParser = FandocParser()
    // docWriter = TsDocWriter(out)
  }

  private OutStream out
  // private FandocParser docParser
  // private TsDocWriter docWriter
  private Type jsFacet := Type.find("sys::Js")

//////////////////////////////////////////////////////////////////////////
// Main writing method
//////////////////////////////////////////////////////////////////////////

  Void writePod(CPod pod)
  {
    throw Err("TODO:FIXIT - using cpod now ${pod}")
  }
/*
  Void writePod(Pod pod)
  {
    // Write dependencies
    pod.depends.each |pod2|
    {
      // TODO: correct file locations/module system?
      out.print("import * as ${pod2.name} from './${pod2.name}.js';\n")
    }
    if (pod.name == "sys") out.print("export type JsObj = Obj | number | string | boolean | Function\n")
    out.write('\n')

    // Write declaration for each type
    pod.types.findAll { !it.isSynthetic }.each |type|
    {
      // TODO: for now generate declaration for all types regardless of whether
      // they have the @Js facet or not
      // if (!type.hasFacet(jsFacet)) return
      if (type.isInternal) return
      if (type.signature == "sys::Func") return

      setupDoc(pod.name, type.name)

      // Parameterization of List & Map
      classParams := ""
      if (type.signature == "sys::List")
        classParams = "<V = unknown>"
      if (type.signature == "sys::Map")
        classParams = "<K = unknown, V = unknown>"

      extends := ""
      if (type.base != null)
        extends = "extends ${getNamespacedType(type.base.name, type.base.pod.name, pod)} "
      if (!type.mixins.isEmpty)
      {
        implement := type.mixins.map { getNamespacedType(it.name, it.pod.name, pod) }.join(", ")
        extends += "implements $implement "
      }

      // Write class documentation & header
      printDoc(type.doc, 0)
      out.print("export class $type.name$classParams $extends{\n")

      // Write fields
      type.fields.each |field|
      {
        if (!field.isPublic) return
        if (type.base?.slot(field.name, false) != null &&
            type.base.slot(field.name).isPublic &&
            !pmap.containsKey(type.signature))
              return

        name := JsNode.nameToJs(field.name)
        staticStr := field.isStatic ? "static " : ""
        typeStr := getJsType(field.type, pod, field.isStatic ? type : null)

        printDoc(field.doc, 2)
        out.print("  $staticStr$name(): $typeStr\n")
        if (!field.isConst)
          out.print("  $staticStr$name(it: $typeStr): void\n")
      }

      // Write methods
      type.methods.each |method|
      {
        if (!method.isPublic) return
        if (type.base?.slot(method.name, false) != null &&
            type.base.slot(method.name).isPublic &&
            !pmap.containsKey(type.signature))
              return

        isStatic := method.isStatic || method.isCtor || pmap.containsKey(type.signature)
        staticStr := isStatic ? "static " : ""
        name := JsNode.nameToJs(method.name)

        inputs := method.params.map |Param p->Str| {
          paramName := JsNode.nameToJs(p.name)
          if (p.hasDefault)
            paramName += "?"
          paramType := getJsType(p.type, pod, isStatic ? type : null)
          return "$paramName: $paramType"
        }.join(", ")
        if (!method.isStatic && !method.isCtor && pmap.containsKey(type.signature))
        {
          selfInput := "self: ${pmap[type.signature]}"
          if (inputs == "") inputs = selfInput
          else inputs = "$selfInput, $inputs"
        }

        output := method.isCtor ? type.name : getJsType(method.returns, pod, pmap.containsKey(type.signature) ? type : null)
        if (method.qname == "sys::Obj.toImmutable" ||
            method.qname == "sys::List.ro" ||
            method.qname == "sys::Map.ro")
              output = "Readonly<$output>"

        printDoc(method.doc, 2)
        out.print("  $staticStr$name($inputs): $output\n")
      }

      out.print("}\n")
    }
  }
  */


//////////////////////////////////////////////////////////////////////////
// Utils
//////////////////////////////////////////////////////////////////////////

  ** Gets the name of the given type in JS. For example, a map type
  ** could show up as Map, sys.Map, Map<string, string>, etc.
  **
  ** 'thisPod' is the pod you are writing the type in; if 'type' is
  ** from a different pod, it will have its pod name prepended to it,
  ** e.g. sys.Map rather than just Map.
  **
  ** 'thisType' should only be non-null if instances of sys::This should
  ** be written as that type instead of "this". For example, Int methods
  ** which are non-static in Fantom but static in JS cannot use the "this"
  ** type.
  private Str getJsType(Type type, Pod thisPod, Type? thisType := null)
  {
    // Built-in type
    if (pmap.containsKey(type.signature))
      return pmap[type.signature]

    // Nullable type
    if (type.isNullable)
      return "${getJsType(type.toNonNullable, thisPod, thisType)} | null"

    // This
    if (type.signature == "sys::This")
      return thisType == null ? "this" : thisType.name

    // L and M for list
    if (thisPod.name == "sys" && type.name == "L")
      return "List<V>"
    else if (thisPod.name == "sys" && type.name == "M")
      return "Map<K,V>"

    // List/map types
    if (type.fits(List#))
      return getGenericType(type, thisPod, ["V"], thisType)

    if (type.fits(Map#))
      return getGenericType(type, thisPod, ["K", "V"], thisType)

    // Function types
    if (type.fits(Func#))
    {
      if (type.isGeneric)
        return "Function"

      args   := type.params.dup
      args.remove("R")
      inputs := args.map |Type p, Str name->Str| { "arg$name: ${getJsType(p, thisPod, thisType)}" }
                    .vals
                    .sort
                    .join(", ")
      output := getJsType(type.params["R"], thisPod, thisType)
      return "(($inputs) => $output)"
    }

    // Obj
    if (type.signature == "sys::Obj")
      return getNamespacedType("JsObj", "sys", thisPod)

    // Regular types
    return getNamespacedType(type.name, type.pod.name, thisPod)
  }

  ** Gets the type string for a generic type like List, Map, Func.
  private Str getGenericType(Type type, Pod thisPod, Str[] params, Type? thisType)
  {
    res := getNamespacedType(type.name, "sys", thisPod)
    if (!type.isGeneric)
    {
      paramStr := params.map |argName|
        {
          // Transform to something like "V = type" if type specified, "" if not
          if (!type.params.containsKey(argName)) return ""

          argStr := getJsType(type.params[argName], thisPod, thisType)
          return argStr
        }
        .removeAll(["", ""])
        .join(", ")
      res += "<$paramStr>"
    }
    return res
  }

  ** Gets the name of the type with, when necessary, the pod name prepended to it.
  ** e.g. could return "TimeZone" or "sys.TimeZone" based on the current pod.
  private Str getNamespacedType(Str typeName, Str typePod, Pod currentPod)
  {
    if (typePod == currentPod.name)
      return typeName
    return "${typePod}.${typeName}"
  }

  private Void setupDoc(Str pod, Str type)
  {
    // docWriter.pod = pod
    // docWriter.type = type
  }

  private Void printDoc(Str? doc, Int indent)
  {
    if (doc == null || doc == "") return

    // docWriter.indent = indent
    // docParser.parse("Doc", doc.in).write(docWriter)
  }

  private const Str:Str pmap :=
  [
    "sys::Bool":    "boolean",
    "sys::Decimal": "number",
    "sys::Float":   "number",
    "sys::Int":     "number",
    "sys::Num":     "number",
    "sys::Str":     "string",
    "sys::Void":    "void"
  ]

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