
/*
@Js class NameSwizzlesTest : Test
{
  Void test()
  {
    sys := "sys"
    pod := Pod.find("sys")
    verifyEq(sys, "sys")
    verifyEq(pod.name, "sys")
    verifyEq(foo("?"), "sys")
  }

  Str foo(Str sys)
  {
    sys = Pod.find("sys").name
    return sys
  }

}
*/