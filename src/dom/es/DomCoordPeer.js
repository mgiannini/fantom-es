//
// Copyright (c) 2017, Brian Frank and Andy Frank
// Licensed under the Academic Free License version 3.0
//
// History:
//   11 Dec 2017  Andy Frank  Creation
//   10 Jun 2023  Kiera O'Flynn  Refactor to ES
//

class DomCoordPeer extends sys.Obj {

  constructor() { super(); }

  static wrap(pos)
  {
    let x = DomCoord.make();
    x.peer.coords = pos.coords;
    x.peer.ts = pos.timestamp ? sys.Duration.fromStr(""+pos.timestamp+"ms") : null;
    return x;
  }

  coords;
  ts;

  lat()              { return this.coords.latitude;  }
  lng()              { return this.coords.longitude; }
  accuracy()         { return this.coords.accuracy;  }
  altitude()         { return this.coords.altitude; }
  altitudeAccuracy() { return this.coords.altitudeAccuracy; }
  heading()          { return this.coords.heading; }
  speed()            { return this.coords.speed; }
  ts()               { return this.ts; }
}