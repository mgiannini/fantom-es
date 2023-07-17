
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