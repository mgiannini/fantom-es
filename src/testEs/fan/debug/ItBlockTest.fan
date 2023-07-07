

/*
@Js class ItBlockTest : Test
{
  Void test()
  {
    b := Base() { it.a = 1; it.s = "foo"; }
    verifyEq(b.a, 1)
    verifyEq(b.s, "foo")
    verifyEq(b.foo, 1)
    verifyEq(b.bar, 2)
  }
}

@Js class Base
{
  new make(|This| f)
  {
    f(this)
  }

  Int foo()
  {
    a := |->Int| { 1 }
    return a()
  }

  Int bar() { func() }

  const Int a
  const Str s
  const |->Int| func := |->Int| { 2 }
}


*/

/*
@Js
enum class FutureState
{
  pending

  ** Return if pending state
  Bool isPending() { this === pending }
}
*/


/*
@Js
class MyBufTest : Test
{
  const static Charset[] charsets := [ Charset.utf8, Charset.utf16BE, Charset.utf16LE ]
  const static Str[] strings := [ "a", "ab", "abc", "\u0080", "\u00FE", "\uabcd", "x\u00FE",
                      "x\uabcd", "\uabcd-\u00FE", ]

  static Void writeChar(OutStream out)
  {
    charsets.each |Charset charset|
    {
      out.charset = charset    // change charset mid-stream
      strings.each |Str str|
      {
        out.write('{')         // binary marker
        out.writeChars(str)    // charset encoding
        out.write('}')         // binary marker
      }
    }
    out.flush
  }
/*

  static Void readChar(Test test, InStream in)
  {
    charsets.each |Charset charset|
    {
      in.charset = charset   // change charset mid-stream
      strings.each |Str str|
      {
        test.verifyEq(in.read, '{')            // binary marker
        for (Int j:=0; j<str.size; ++j)
          test.verifyEq(in.readChar(), str[j]) // charset encoding
        test.verifyEq(in.read, '}')            // binary marker
      }
    }
  }
  */

  Void test()
  {
  }
}
*/
@Js class InfTest : Test
{
  Void testInference()
  {
    // verifyType([,],     Obj?[]#)
    // verifyType(Obj?[,], Obj?[]#)
    // verifyType(Obj[,],  Obj[]#)
    // verifyType([null],  Obj?[]#)
    // verifyType([null,null], Obj?[]#)
    // verifyType([2,null],  Int?[]#)
    // verifyType([null,2],  Int?[]#)
    // verifyType([2,null,2f], Num?[]#)
    // verifyType([null,3,2f], Num?[]#)

    // // // expressions used to create list literal
    [Str:Int]? x := null
    // verifyType([this->toStr], Obj?[]#)
    // verifyType([Pod.find("xxxx", false)], Pod?[]#)
    // verifyType([this as Test], Test?[]#)
    // verifyType([(Obj?)this ?: "foo"], Obj?[]#)
    // verifyType([x?.toStr], Str?[]#)
    verifyType([x?.def], Int?[]#)
    // verifyType([x?.caseInsensitive], Bool?[]#)
    // verifyType([x?->foo], Obj?[]#)
    // verifyType([returnThis], ListTest[]#)
    // verifyType([x == null ? "x" : null], Str?[]#)
    // verifyType([x == null ? null : 4f], Float?[]#)
  }
}