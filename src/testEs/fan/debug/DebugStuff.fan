

@Js class DebugTest : Test
{
  Void testSynthetic()
  {
    Pod.of(this).types.each |Type t|
    {
      verifyEq(t.isSynthetic, t.name.index("\$") != null, t.toStr)
      verifySlotsSynthetic(t)
    }
  }

  Void verifySlotsSynthetic(Type t)
  {
    t.slots.each |Slot slot|
    {
      if (slot.parent.isSynthetic || slot.name.index("\$") != null)
        verify(slot.isSynthetic, slot.toStr)
    }
  }
}