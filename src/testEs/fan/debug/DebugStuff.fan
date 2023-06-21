
@Js mixin Mix {
  virtual Str bar() { "xxxbar" }
  virtual Str mix() { "mix${bar}" }

}
@Js class Foo : Mix {
  Int i := 0
  const Int c := 0
  override Str bar() { "bar" }
}
@Js class Bar : Foo {
  override Str bar() { "override ${super.bar}" }
  override Str mix() { "override ${super.mix}" }
  Int s1() { super.i = 1; return super.i; }
}
@Js class DebugTest : Test
{
  Int f1 := 0
  Str? x := null
  Void testSuper()
  {
    verifyEq(Bar().bar, "override bar")
    verifyEq(Bar().mix, "override mixoverride bar")
    verifyEq(Bar().i, 0)
    verifyEq(Bar().s1, 1)
  }

  Void testSafe()
  {
    Int? a := null
    verifyNull(a?.toStr)
    a = 1
    verifyEq(a?.toStr, "1")
    verifyNull(this.x?.toInt)
    // verifyEq(Bar().c, 0)
  }

  // Void testAssign()
  // {
  //   x := 0
  //   ++x
  //   verifyEq(x, 1)
  //   x += 1
  //   verifyEq(x, 2)
  //   x++
  //   verifyEq(x, 3)
  //   verifyEq(x++, 3)
  //   verifyEq(x, 4)

  //   ++f1
  //   verifyEq(f1, 1)

  //   f1++
  //   verifyEq(f1, 2)

  //   arr := [1,2,3]
  //   arr[1] += 100
  //   verifyEq(arr, [1,102,3])
  //   verifyEq(arr[0]++, 1)
  //   verifyEq(arr[0], 2)
  //   verifyEq(++arr[0], 3)

  // }

  // Void testTernary()
  // {
  //   x := 1 > 0 ? 100 : 200
  //   verifyEq(x, 100)

  //   x = 1 < 0 ? 100 : 200
  //   verifyEq(x, 200)

  //   try
  //   {
  //     x = 1 == 1 ? throw Err("nope") : 100
  //     verify(false)
  //   }
  //   catch (Err err) verify(true)

  //   try
  //   {
  //     x = 1 == 2 ? 200 : throw Err("nope")
  //     verify(false)
  //   }
  //   catch (Err err) verify(true)
  // }

  // Void testElvis()
  // {
  //   Int? x := null ?: 100
  //   verifyEq(x, 100)
  //   x = (x ?: 200) + 1
  //   verifyEq(x, 101)

  //   try
  //   {
  //     y := null ?: throw Err("nope")
  //   }
  //   catch (Err err)
  //   {
  //     verifyEq(err.msg, "nope")
  //   }
  // }

  // Void testSwitch()
  // {
  //   x := 0
  //   v := 0
  //   d := 0
  //   for (i := 0; i < 10; i = i + 1)
  //   {
  //     switch (i)
  //     {
  //       case 0:
  //         x = 100
  //       case 1:
  //       case 2:
  //       case 3:
  //         v = v + 1
  //       default:
  //         d = d + 1
  //     }
  //   }
  //   verifyEq(v, 3)
  //   verifyEq(x, 100)
  //   verifyEq(d, 6)
  // }

  // Void testWhile()
  // {
  //   i := 0
  //   while ((i = i + 1) != 2)  { }
  //   verifyEq(i, 2)
  //   i = 0
  //   while (i != 2) { i = i + 1 }
  //   verifyEq(i, 2)
  // }

  // Void testFor()
  // {
  //   i := 0
  //   for (;;) { break }
  //   verifyEq(i, 0)

  //   for(;;)
  //   {
  //     if (i == 2) break
  //     i = i + 1
  //     continue
  //     throw Err("uh-oh")
  //   }
  //   verifyEq(i, 2)

  //   i = 0
  //   for (; i< 2;) { i = i + 1 }
  //   verifyEq(i, 2)

  //   i = 0
  //   for (; i<2; i = i + 1) { }
  //   verifyEq(i, 2)

  //   for (i = 0; i < 2; i = i + 1) { }
  //   verifyEq(i, 2)

  //   for (i = 0; ; i = i + 1) { if (i == 2) break }
  //   verifyEq(i, 2)
  // }

  // Void testTryCatch()
  // {
  //   try
  //   {
  //     throw ArgErr("uh-oh")
  //   }
  //   catch (TimeoutErr timeout)
  //   {
  //     verify(false)
  //   }
  //   catch (ArgErr x)
  //   {
  //     x.trace
  //     verify(true)
  //   }
  //   // catch
  //   // {
  //   //   verify(false)
  //   // }
  //   finally
  //   {
  //     echo("done!")
  //     verify(true)
  //   }
  // }

  // Void testSynthetic()
  // {
  //   Pod.of(this).types.each |Type t|
  //   {
  //     verifyEq(t.isSynthetic, t.name.index("\$") != null, t.toStr)
  //     verifySlotsSynthetic(t)
  //   }
  // }

  // Void verifySlotsSynthetic(Type t)
  // {
  //   t.slots.each |Slot slot|
  //   {
  //     if (slot.parent.isSynthetic || slot.name.index("\$") != null)
  //       verify(slot.isSynthetic, slot.toStr)
  //   }
  // }
}