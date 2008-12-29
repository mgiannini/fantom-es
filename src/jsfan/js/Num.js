//
// Copyright (c) 2008, Brian Frank and Andy Frank
// Licensed under the Academic Free License version 3.0
//
// History:
//   26 Dec 08  Andy Frank  Creation
//

/**
 * Num
 */
var sys_Num = sys_Obj.extend(
{

//////////////////////////////////////////////////////////////////////////
// Constructor
//////////////////////////////////////////////////////////////////////////

  $ctor: function() {},

//////////////////////////////////////////////////////////////////////////
// Methods
//////////////////////////////////////////////////////////////////////////

  type: function()
  {
    return sys_Type.find("sys::Num");
  },

});

//////////////////////////////////////////////////////////////////////////
// Static Methods
//////////////////////////////////////////////////////////////////////////

sys_Num.toDecimal = function(val) { return val; }
sys_Num.toFloat = function(val) { return val; }
sys_Num.toInt = function(val)
{
  if (isNaN(val)) return 0;
  if (val == Number.POSITIVE_INFINITY) return sys_Int.maxValue.val;
  if (val == Number.NEGATIVE_INFINITY) return sys_Int.minValue.val;
  return Math.floor(val);
}