
/*
@Js
class SandboxTest : Test
{
  Void testA()
  {
    verify(true)

    a := A()

    verifyEq(a.k, 100)

    verifyEq(a.i, -1)
    a.i = 314
    verifyEq(a.i, 314)
    a.i = -2
    verifyEq(a.i, 0)

    a.var = "foo"
    verifyEq(a.var, "foo")

    b := B(1234)
    verifyEq(b.i, 1234)

    c := C()
    verifyEq(c.i, 2)
  }
}

@Js class A : FooMixin
{
  Int i := -1
  {
    get {
      foo := 1
      return &i * foo
    }
    set
    {
      if (it < 0) it = 0
      &i = it
    }
  }
  Str var := ""
  private Int j := 0
  Int k := 100 { private set }
  Void set(Int x := 0) { this.j = x }
  Int get() { j }
  override Str msg() { "hello" }
  override Str toStr() { hello }
}

// @Js class B : A
// {
//   new make(Int x := 1) : super.make()
//   {
//     this.i = x
//   }
// }

// @Js class C : B
// {
//   new make() : super.make(2)
//   {
//     Str? s := null
//     // u := s?.upper?.lower
//   }
// }

@Js mixin FooMixin
{
  abstract Str msg()
  Str hello() { msg }
}
*/