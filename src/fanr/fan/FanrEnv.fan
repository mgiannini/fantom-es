//
// Copyright (c) 2011, Brian Frank and Andy Frank
// Licensed under the Academic Free License version 3.0
//
// History:
//   24 Jun 11  Brian Frank  Creation
//

**
** FanrRepo models the local environment that we install to
** and publish from.
**
class FanrEnv
{
  ** Constructor for given `sys::Env`
  new make(Env env := Env.cur) { this.env = env }

  ** Env instance wrapped
  const Env env

  ** Find a pod by name in local environment and return as PodSpec
  PodSpec? find(Str podName)
  {
    if (byName.containsKey(podName)) return byName[podName]
    file := Env.cur.findPodFile(podName)
    spec := file == null ? null : PodSpec.load(file)
    byName[podName] = spec
    return spec
  }

  ** Match a set of pods in local environment and return as PodSpecs
  PodSpec[] query(Str query, OutStream logOut := Env.cur.out)
  {
    q := Query.fromStr(query)

    // optimize one exact pod name (no wildcards)
    if (q.parts.size == 1 && q.parts[0].isNameExact)
    {
      spec := find(q.parts[0].namePattern)
      return spec == null ? PodSpec[,] : [spec]
    }

    // search thru all of them
    return allPods.findAll |p| { q.include(p) }
  }

  ** Lazily load all pods as PodSpecs
  private once PodSpec[] allPods()
  {
    acc := PodSpec[,]
    env.findAllPodNames.each |name|
    {
      try
        acc.add(find(name))
      catch (Err e)
        echo("ERROR: Cannot query pod: $name\n  $e")
    }
    return acc
  }

  Str:PodSpec? byName := [:]   // pods loaded by name
}