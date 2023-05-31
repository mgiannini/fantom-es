
@Js
internal enum class EnumAbc
{
  A, B, C

  Int negOrdinal() { return -ordinal }

  static const EnumAbc first := A
}