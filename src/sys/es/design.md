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
    if (it===undefined) return this.#a;
    else this.#a = it;
  }
  
  #b = 0;
  
  // has only public getter
  b() { return this.#b; }
  
  #c = 0;
  // no method generated for #c since it has private getter/setter
}

let f = new Foo();
f.a(100);
console.log(`The value of a is now ${f.a()}`);
```

# Fields - Alternate Proposal

Another option is to treat no-arg methods as special. In the case of a no-arg method/field we would an ES6 getter/setter. 
This has a few benefits:

1. It allows you to access the field/method without having to use `()`. The resutling code is more readable; especially when chaining
no arg method calls. `foo.bar.baz`
2. When the code is used in TypeScript, it will adhere more closely to TS conventions.
3. It mimics how Fantom works with no-arg methods

Some potential drawbacks:

1. It breaks the uniformity of having *every* method/field treated the same.
2. If a no-arg method ever gets modified to add a parameter (e.g. a single parameter with a default value), it will break existing
code since it *must* be generated as a normal method instead of a getter.

Here is an example of what this code might look like. 

```
# Fantom
mixin Foo {
  virtual Str baz() { "foo" }
  virtual Str qaz() { "qaz" }
}

class Bar : Foo {
  override Str baz := "bar"
} 

# JavaScript
class Foo {
  get baz() { return "baz"; }
  get qaz() { return "qaz"; }
}

class Bar extends Obj {
  #baz = "bar"; // this would actually get initialized in the generated constructor
  get baz() { return this.#baz; }
  set baz(it) { this.#baz = it; }

  qaz = Foo.prototype.qaz; // this is how mixins are handled (no change)
}

let b = new Bar();
# access baz as getter/setter now
b.baz = "abc123";
console.log(`The new value of baz is ${b.baz}`);
```

This would also impact how we generate fields for Enums

```
# Here is the current pattern for Enums using LogLevel as an example
class LogLevel extends Enum {
  constructor(ordinal, name) {
    super();
    Enum.make$(this, ordinal, name);
  }

  static debug() { return LogLevel.vals().get(0); }
  static info() { return LogLevel.vals().get(1); }
  static warn() { return LogLevel.vals().get(2); }
  static err() { return LogLevel.vals().get(3); }
  static silent() { return LogLevel.vals().get(4); }

  static #vals = undefined;
  static vals() {
    if (LogLevel.#vals === undefined) {
      LogLevel.#vals = List.make(LogLevel.type$,
        [new LogLevel(0, "debug"), new LogLevel(1, "info"),
         new LogLevel(2, "warn"), new LogLevel(3, "err"),
         new LogLevel(4, "silent")]).toImmutable();
    }
    return LogLevel.#vals;
  }
}

# We would turn these into static getters:
class LogLevel extends Enum {
  ...

  static get debug() { return LogLevel.vals().get(0); }
  static get info() { return LogLevel.vals().get(1); }
  static get warn() { return LogLevel.vals().get(2); }
  static get err() { return LogLevel.vals().get(3); }
  static get silent() { return LogLevel.vals().get(4); }

  ...
}

```

