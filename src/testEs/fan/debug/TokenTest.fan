//
// Copyright (c) 2006, Brian Frank and Andy Frank
// Licensed under the Academic Free License version 3.0
//
// History:
//   16 Apr 06  Brian Frank  Creation
//

@Js class TokenTest : Test
{
  Void test()
  {
    echo(Token.keywords.join("\n"))
  }
}

**
** Token is the enum for all the token types.
**
@Js enum class Token
{

//////////////////////////////////////////////////////////////////////////
// Enum
//////////////////////////////////////////////////////////////////////////

  // identifer/literals
  identifier      ("identifier"),

  // operators
  dot("."),
  semicolon     (";"),

  // keywords
  abstractKeyword,
  asKeyword,

  // misc
  eof("eof");

  // potential keywords:
  //   async, checked, contract, decimal, duck, def, isnot,
  //   namespace, once, unchecked, unless, when,  var, with

//////////////////////////////////////////////////////////////////////////
// Constructor
//////////////////////////////////////////////////////////////////////////

  **
  ** Construct with symbol str, or null symbol for keyword.
  **
  private new make(Str? symbol := null)
  {
    if (symbol == null)
    {
      if (!name.endsWith("Keyword")) throw Err(name)
      this.symbol   = name[0..-8]
      this.keyword  = true
      this.isAssign = false
    }
    else
    {
      this.symbol   = symbol
      this.keyword  = false
      this.isAssign = name.startsWith("assign")
    }
  }

//////////////////////////////////////////////////////////////////////////
// Methods
//////////////////////////////////////////////////////////////////////////

  override Str toStr() { symbol }

//////////////////////////////////////////////////////////////////////////
// Keyword Lookup
//////////////////////////////////////////////////////////////////////////

  **
  ** Get a map of the keywords
  **
  const static Str:Token keywords
  static
  {
    map := Str:Token[:]
    vals.each |Token t|
    {
      if (t.keyword) map[t.symbol] = t
    }
    keywords = map
  }

//////////////////////////////////////////////////////////////////////////
// Test
//////////////////////////////////////////////////////////////////////////

  static Void main()
  {
    vals.each |Token t|
    {
      echo(t.name + "  '" + t.symbol + "'")
    }

    echo(keywords)
  }

//////////////////////////////////////////////////////////////////////////
// Fields
//////////////////////////////////////////////////////////////////////////

  ** Get string used to display token to user in error messages
  const Str symbol

  ** Is this a keyword token such as "null"
  const Bool keyword

  ** Is this an assignment token such as "=", etc "+=", etc
  const Bool isAssign

}