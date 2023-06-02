This document describes how we map Fantom to ES6 JavaScript.

# Naming

All class names are preserved when going from Fantom to JavaScript.

Slot and Parameter names that conflict with built-in JS keywords are "pickled" to end with a `$`. The
list of names that gets pickled can be found in [compilerEs::JsNode](/src/compilerEs/fan/ast/JsNode.fan).

```
# Fantom
Void name(Str var) { ... }

# JavaScript
name$(var$) { ... }
```

As a general rule, any field or method that ends with `$` should be considered "public" API when 
using the JS code natively in an environment like Node or the browser. There are several "internal"
methods and fields that are intended for compiler support and they will be prefixed with two underbars
`__`. They should not be used by consumers of the generated JS code and are subject to change at any time.

```
# JavaScript - these should be considered private
static __registry = {};

__at(a,b,c) { ... }
```

***TODO:FIXIT:  I have not implemented the `__` rule. Internal methods and fields currently end in `$` like
pickled names. I feel that we should make a naming distinction between public/pickled names and internal names.***

# Fields

All Fantom fields are generated as private in the JavaScript and the compiler will generate a single 
method for getting/setting the field based on the access flags for the getter/setter in Fantom. The 
generated getter/setter will conform to the [Naming](#naming) rules outlined above.

```
# Fantom
class Foo
{
  Int a := 0
  Int b := 1 { private set }
  private Int c := 2
}

# JavaScript
class Foo extends sys.Obj {
  constructor() { 
    super();
    this.#a = 0;
    this.#b = 1;
    this.#c = 2;
  }
  
  #a = 0;
  
  // has public getter/setter
  a(it=undefined) {
    if (it==undefined) return this.#a;
    else this.#a = it;
  }
  
  #b = 0;
  
  // has only public getter
  b() { return this.#b; }
  
  #c = 0;
  // no method generated for #c since it has private getter/setter
}
```
