//
// Copyright (c) 2023, Brian Frank and Andy Frank
// Licensed under the Academic Free License version 3.0
//
// History:
//   24 Jun 23  Kiera O'Flynn  Creation
//

using fandoc

**
** Writes Fantom documentation in Typescript markdown style.
**
class TsDocWriter : DocWriter
{
  Int indent := 0
  { set { ind = " " * it; &indent = it } }
  private Str ind := ""

  Str pod := ""
  Str type := ""

  private OutStream out
  private Bool started := false
  private ListIndex[] listIndexes := [,]
  private Bool inBlockquote

  new make(OutStream out)
  {
    this.out = out
  }

  **
  ** Enter a document.
  **
  override Void docStart(Doc doc)
  {
    out.print("$ind/**\n$ind * ")
    started = false
  }

  **
  ** Exit a document.
  **
  override Void docEnd(Doc doc)
  {
    out.print("\n$ind */\n")
  }

  **
  ** Enter an element.
  **
  override Void elemStart(DocElem elem)
  {
    switch (elem.id)
    {
      case DocNodeId.doc:
        return

      case DocNodeId.emphasis:
        out.writeChar('*')

      case DocNodeId.strong:
        out.print("**")

      case DocNodeId.code:
        out.writeChar('`')

      case DocNodeId.link:
        link := (Link) elem
        onLink(link)
        if (link.isCode)
          out.print("{@link $link.uri | ")
        else
          out.writeChar('[')

      case DocNodeId.image:
        img := (Image) elem
        out.print("![${img.alt}")
      
      case DocNodeId.heading:
        head := (Heading) elem
        printLine
        printLine
        out.print(Str.defVal.padl(head.level, '#')).writeChar(' ')

      case DocNodeId.para:
        para := (Para) elem
        if (!listIndexes.isEmpty)
        {
          indent := listIndexes.size * 2
          printLine
          printLine
          out.print(Str.defVal.padl(indent))
        }
        else if (started)
        {
          printLine
          printLine
        }

        if (inBlockquote)
          out.print("> ")
        if (para.admonition != null)
          out.print("${para.admonition}: ")

      case DocNodeId.pre:
        printLine
        out.print("```")
        printLine

      case DocNodeId.blockQuote:
        inBlockquote = true

      case DocNodeId.unorderedList:
        listIndexes.push(ListIndex())

      case DocNodeId.orderedList:
        ol := (OrderedList) elem
        listIndexes.push(ListIndex(ol.style))

      case DocNodeId.listItem:
        printLine
        indent := (listIndexes.size - 1) * 2
        out.print(Str.defVal.padl(indent))
        out.print(listIndexes.peek)
        listIndexes.peek.increment

      case DocNodeId.hr:
        printLine
        printLine
        out.print("---")
    }
    started = true
  }

  **
  ** Exit an element.
  **
  override Void elemEnd(DocElem elem)
  {
    switch (elem.id)
    {
      case DocNodeId.emphasis:
        out.writeChar('*')

      case DocNodeId.strong:
        out.print("**")

      case DocNodeId.code:
        out.writeChar('`')

      case DocNodeId.link:
        link := (Link) elem
        if (link.isCode)
          out.writeChar('}')
        else
          out.print("](${link.uri})")

      case DocNodeId.image:
        img := (Image) elem
        out.print("](${img.uri})")

      case DocNodeId.pre:
        printLine
        out.print("```")

      case DocNodeId.blockQuote:
        inBlockquote = false

      case DocNodeId.unorderedList:
      case DocNodeId.orderedList:
        listIndexes.pop
    }
  }

  **
  ** Write text node.
  **
  override Void text(DocText text)
  {
    out.print(text.toStr.replace("\n", "\n$ind * ").replace("*/", "*\\/"))
  }

  private Void printLine(Str line := "")
  {
    out.print("$line\n$ind * ")
  }

  private Void onLink(Link link)
  {
    slotMatcher := Regex("(((.+)::)?(.+)\\.)?(.+)", "g").matcher(link.uri)
    typeMatcher := Regex("((.+)::)?(.+)", "g").matcher(link.uri)
    docMatcher  := Regex("(doc.+)::(.+)", "g").matcher(link.uri)

    if (slotMatcher.matches)
    {
      p := slotMatcher.group(3) ?: pod
      t := slotMatcher.group(4) ?: type
      s := slotMatcher.group(5)

      if (Slot.find("$p::${t}.$s", false) != null)
      {
        s = JsNode.nameToJs(s)
        if (p != pod)       link.uri = "${p}.${t}.$s"
        else if (t != type) link.uri = "${t}.$s"
        else                link.uri = s

        link.isCode = true
        return
      }
    }

    if (typeMatcher.matches)
    {
      p := typeMatcher.group(2) ?: pod
      t := typeMatcher.group(3)

      if (Type.find("$p::$t", false) != null)
      {
        if (p != pod) link.uri = "${p}.$t"
        else          link.uri = t

        link.isCode = true
        return
      }
    }

    if (docMatcher.matches)
      link.uri = "https://fantom.org/doc/${docMatcher.group(1)}/${docMatcher.group(2)}"
  }

}

// Taken from FandocDocWriter.fan
internal class ListIndex
{
  private static const Int:Str romans  := sortr([1000:"M", 900:"CM", 500:"D", 400:"CD", 100:"C", 90:"XC", 50:"L", 40:"XL", 10:"X", 9:"IX", 5:"V", 4:"IV", 1:"I"])

  OrderedListStyle? style
  Int index  := 1

  new make(OrderedListStyle? style := null)
  {
    this.style = style
  }

  This increment()
  {
    index++
    return this
  }

  override Str toStr()
  {
    switch (style)
    {
      case null:
        return "- "
      case OrderedListStyle.number:
        return "${index}. "
      case OrderedListStyle.lowerAlpha:
        return "${toB26(index).lower}. "
      case OrderedListStyle.upperAlpha:
        return "${toB26(index).upper}. "
      case OrderedListStyle.lowerRoman:
        return "${toRoman(index).lower}. "
      case OrderedListStyle.upperRoman:
        return "${toRoman(index).upper}. "
    }
    throw Err("Unsupported List Style: $style")
  }

  private static Str toB26(Int int)
  {
    int--
    dig := ('A' + (int % 26)).toChar
    return (int >= 26) ? toB26(int / 26) + dig : dig
  }

  private static Str toRoman(Int int)
  {
    l := romans.keys.find { it <= int }
    return (int > l) ? romans[l] + toRoman(int - l) : romans[l]
  }

  private static Int:Str sortr(Int:Str unordered)
  {
    // no ordered literal map... grr...
    // https://fantom.org/forum/topic/1837#c14431
    sorted := [:] { it.ordered = true }
    unordered.keys.sortr.each { sorted[it] = unordered[it] }
    return sorted
  }
}