
/*
using [java]java.lang::Thread as JavaThread
using [java]java.lang.management
using [java]java.lang::StackTraceElement

@Js class NTest : Test
{

  Void test()
  {
    deadlocked := bean.findDeadlockedThreads
    id := deadlocked[0]
  }
  private ThreadMXBean bean := ManagementFactory.getThreadMXBean
}
*/

/*
@Js class SuperTest : Test
{
  Void test()
  {
    verifyEq(XetoSpec(MSpec("foo")).toStr, "foo")
    verifyEq(XetoSpec().toStr, "Debug Dict")
  }
}

@Js
internal const class XetoSpec : Spec, Dict, CSpec
{
  new make() {}

  new makem(MSpec m) { this.m = m }

  override final Str toStr() { m?.toStr ?: super.toStr }

  const MSpec? m
}

@Js
const class MSpec
{
  new make(Str s) { this.s = s }
  const Str s
  override Str toStr() { s }
}

@Js
const mixin Spec : Dict
{

}

@Js
const mixin XetoDict
{

  // ** Specification of this dict or 'sys::Dict' if generic.
  // abstract Spec spec()

}

@Js
const mixin Dict : XetoDict
{

  ** Return string for debugging only
  override Str toStr() { "Debug Dict" }
}

@Js
mixin CSpec
{
}

*/