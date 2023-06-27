#! /usr/bin/env fan
//
// Copyright (c) 2006, Brian Frank and Andy Frank
// Licensed under the Academic Free License version 3.0
//
// History:
//   5 Nov 06  Brian Frank  Creation
//

using build

**
** Build: testEs
**
class Build : BuildPod
{
  new make()
  {
    podName = "testEs"
    summary = "System and runtime test suite for ES"
    meta    = ["org.name":     "Fantom",
               "org.uri":      "https://fantom.org/",
               "proj.name":    "Fantom Core",
               "proj.uri":     "https://fantom.org/",
               "license.name": "Academic Free License 3.0",
               "vcs.name":     "Git",
               "vcs.uri":      "https://github.com/fantom-lang/fantom",
               "testSys.foo":"got\n it \u0123"]
    depends = ["sys 1.0",
               // "util 1.0",
               // "web 1.0",
               // "concurrent 1.0",
              ]
    index   = [
      "testSys.single": "works!",
      "testSys.mult": ["testSys-1","testSys-2"],
      //"sys.envProps": "testSys",
    ]
    srcDirs = [
               `fan/`,
               // `fan/debug/`,
              ]
    // resDirs = [`res/`, `locale/`, `concurrent/locale/`]
    resDirs = [`res/`, `locale/`,]
    jsDirs = [`js/`]
    docApi  = false
  }
}