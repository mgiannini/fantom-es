

@Js class DebugTest : Test
{

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