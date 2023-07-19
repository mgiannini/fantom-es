This is a "living" document covering many aspects of the design and implementation
for the mapping from Fantom to ES6 JavaScript.

# Getting Started
So you just cloned this repo. This section provides an overview of the code
organization and the commands you need to run to get started with the JavaScript.
As you read through this document keep in mind that both the "old" way of generating
JS and the new way will co-exist side-by-side for a transition period.

The ES6 implementation of the `sys` pod is in `src/sys/es/`.  The build script in
that directory takes care of packaging all the sys code into a single ESM module
and putting it in `sys.pod`. All ESM modules are stored in pods in the `/esm/` directory.
For `sys` only do we also generate a CommonJS (CJS) implementation as well. It is stored
in the `/cjs/` directory of the `sys.pod`.

## CompilerES

There is a new JavaScript compiler for generating ES code. The pod is called `compileEs`.
It serves the same purpose as the old `compilerJs` pod, but emits ES6code and a 
corresponding source map. Currently, the compiler only emits an ESM module for the code.
All generated artifacts are stored in the pod at `/esm/`.

## Standard Build

To build the code run `fan src\buildall.pod`. Remember that we will generate both the old and new JS code
during this transition period. 

You could now run the `testDomkit` pod to see the various domkit widgets renedered in the
browser using the ES6 code:

`fan testDomkit -es`

## compilerEs::NodeRunner

NOTE: this class will eventually be moving to the `nodeJs` pod.

You can use the `compilerEs::NodeRunner` class to run the JS code in the NodeJS environment.
You must have NodeJS installed on your system and available in your PATH.

To run a test suite you would execute:

```
fan copmilerEs::NodeRunner -test <pod>[::<test>[.<method>]]

// Examples
fan compilerEs::NodeRunner -test concurrent
fan compilerEs::NodeRunner -test testSys::UriTest
```

## Node Packaging

You can stage all the ES javascript into the filesystem for running in Node by using the `NodeRunner`.
The full set of steps to accomplish this is

1. `fan src/buildall.fan`
2. `fan compilerEs::NodeRunner -init` This will create the initial node package in `<fan_home>/lib/es/`
and stage the `sys.js` code.
3. `fan src/buildpods.fan js` Run only on the non-bootstrap pods to generate JS code for *all* types
in a pod. It then stages the js and a typescript declaration file (`d.ts`) to the node package
in `<fan_home>/lib/es/`

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

