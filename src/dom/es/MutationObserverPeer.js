//
// Copyright (c) 2016, Brian Frank and Andy Frank
// Licensed under the Academic Free License version 3.0
//
// History:
//   8 Mar 2016  Andy Frank  Creation
//   10 Jun 2023 Kiera O'Flynn  Refactor to ES
//

class MutationObserverPeer extends sys.Obj {

  constructor(self)
  {
    super();
    this.observer = new MutationObserver(function(recs)
    {
      const list = MutationObserverPeer.$makeRecList(recs);
      const args = sys.List.make(sys.Obj.$type, [list]);
      self.m_callback.callOn(self, args);
    });
  }

  observe(self, target, opts)
  {
    const config = {
      childList:             opts.get("childList")      == true,
      attributes:            opts.get("attrs")          == true,
      characterData:         opts.get("charData")       == true,
      subtree:               opts.get("subtree")        == true,
      attributeOldValue:     opts.get("attrOldVal")     == true,
      characterDataOldValue: opts.get("charDataOldVal") == true,
    };
    const filter = opts.get("attrFilter")
    if (filter != null) config.attributeFilter = filter.m_values;
    this.observer.observe(target.peer.elem, config);
    return self;
  }

  takeRecs = function(self)
  {
    const recs = this.observer.takeRecords();
    return MutationObserverPeer.$makeRecList(recs);
  }

  disconnect = function(self)
  {
    this.observer.disconnect();
  }

  static $makeRec = function(rec)
  {
    const fanRec = MutationRec.make();

    if (rec.type == "attributes") fanRec.m_type = "attrs";
    else if (rec.type == "characterData") fanRec.m_type = "charData";
    else fanRec.m_type = rec.type;

    fanRec.m_target = ElemPeer.wrap(rec.target);
    fanRec.m_attr   = rec.attributeName;
    fanRec.m_attrNs = rec.attributeNamespace;
    fanRec.m_oldVal = rec.oldValue;

    if (rec.previousSibling) fanRec.m_prevSibling = ElemPeer.wrap(rec.previousSibling);
    if (rec.nextSibling) fanRec.m_nextSibling = ElemPeer.wrap(rec.nextSibling);

    const added = new Array();
    for (let i=0; i<rec.addedNodes.length; i++)
      added.push(ElemPeer.wrap(rec.addedNodes[i]));
    fanRec.m_added = sys.List.make(Elem.$type, added);

    const removed = new Array();
    for (let i=0; i<rec.removedNodes.length; i++)
      removed.push(ElemPeer.wrap(rec.removedNodes[i]));
    fanRec.m_removed = sys.List.make(Elem.$type, removed);

    return fanRec;
  }

  static $makeRecList = function(recs)
  {
    const list = new Array();
    for (let i=0; i<recs.length; i++)
      list.push(MutationObserverPeer.$makeRec(recs[i]));
    return sys.List.make(MutationRec.$type, list);
  }
}