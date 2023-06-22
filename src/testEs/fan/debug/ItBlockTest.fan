

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

@Js
enum class FutureState
{
  pending

  ** Return if pending state
  Bool isPending() { this === pending }
}