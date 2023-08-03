
@Js class MethFuncTest : Test
{
  Void testMethodFunc()
  {
    f := |Str s->Void| { echo(s) }
    f("foo")
    g("bar")
    func := #staticJudge.func
    verifyEq(func.call("Dredd"), "Dredd")
    verifyEq(func.callOn(null, ["Hershey"]), "Hershey")
    verifyEq(func.callList(["Anderson"]), "Anderson")
    verifyEq(func.arity, 1)

    func = #judge.func
    verifyEq(func.call(this, "Dredd"), "Dredd")
    verifyEq(func.callOn(this, ["Hershey"]), "Hershey")
    verifyEq(func.callList([this, "Anderson"]), "Anderson")
    verifyEq(func.arity, 2)

    //echo("params -> ${func.params}")
    //echo("typeof -> ${func.typeof}")
    //echo("toStr  -> ${func}")
  }

  |Str s->Void| g := |Str s->Void| { echo(s) }

  Str judge(Str who) { who }
  static Str staticJudge(Str who) { who }
}
/*
@Js class FuncTest : Test
{
  Void test()
  {
  }
}

@Js class ListButton
{
  private Func? cbSelect := null

  Void onSelect(|Obj->Obj| f)
  {
    this.cbSelect = f
  }

  Void fireSelect() { cbSelect?.call(this) }
}
*/