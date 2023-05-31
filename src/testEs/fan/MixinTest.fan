
@Js
mixin MxA
{
  static Str sa() { "sa" }
  Str ia() { "ia" }
  Str wrapToStr1() { this.toStr }  // explicit this
  Str wrapToStr2() { toStr }       // implicit this
  static Type staticWrapType(MxA a) { Type.of(a) }
  virtual Str va() { "va" }
  abstract Str aa()
  virtual Obj coa() { "1" }
  virtual Obj cob() { "2" }
  virtual Obj coc() { "3" }
  virtual This thisa() { this }
  virtual This thisb() { this }
}

@Js
mixin MxB
{
  static Str sb() { "sb" }
  Str ib() { "ib" }
  virtual Str vb() { "vb" }
  abstract Str ab()
}

@Js
class MxClsA : MxA
{
  override Str aa() { return "aa" }
  override Str va() { return "override-va" }
  override This thisa() { throw UnsupportedErr() }
  Str mxClsA() { return "MxClsA" }
}

@Js
class MxClsAB : MxA, MxB
{
  override Str aa() { return "aa" }
  override Str ab() { return "ab" }
  override Str vb() { return "override-vb" }
  override Str toStr() { return "MxClsAB!" }
  override Str cob() { return "22" }
  Str mxClsAB() { return "MxClsAB" }
}