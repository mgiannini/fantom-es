//
// Copyright (c) 2008, Brian Frank and Andy Frank
// Licensed under the Academic Free License version 3.0
//
// History:
//   21 Jul 08  Brian Frank  Creation
//

using fwt

**
** Frame is the main top level window in flux applications.
**
class Frame : Window
{

//////////////////////////////////////////////////////////////////////////
// Views
//////////////////////////////////////////////////////////////////////////

  **
  ** Get the list of views this frame has opened in tabs.
  **
  View[] views() { return tabPane.views }

  **
  ** Get the active view.  A given frame always has
  ** exactly one view active.
  **
  View view() { return tabPane.active.view }

  **
  ** Select the active view tab.
  **
  Void select(View view) { tabPane.select(view.tab) }

  **
  ** Load the specified resource in the active tab.
  ** The default mode will replace the current tab.
  **
  Void load(Resource r, LoadMode mode := LoadMode())
  {
    doLoad(this, r, mode)
  }

  **
  ** Load the specified resource Uri in the active tab.
  ** The default mode will replace the current tab.
  **
  Void loadUri(Uri uri, LoadMode mode := LoadMode())
  {
    doLoad(this, uri, mode)
  }

  **
  ** Internal common implementation for loading.
  **
  internal static Void doLoad(Frame frame, Obj target, LoadMode mode)
  {
    // get window to load
    if (mode.newWindow)
    {
      echo("TODO: new window not done yet")
      mode.newTab = true
    }

    // get tab to load
    tab := frame.view.tab
    if (mode.newTab || frame.view.dirty)
     tab = frame.tabPane.newTab

    // load the tab
    if (target is Uri)
      tab.loadUri(target, mode)
    else
      tab.load(target, mode)

    // select the tab once loading is done to deactivate old
    // tab and activate this one (if we switched tabs)
    frame.tabPane.select(tab)
  }

//////////////////////////////////////////////////////////////////////////
// Internal Construction
//////////////////////////////////////////////////////////////////////////

  internal new make() : super()
  {
    title = "Flux"
    icon  = Flux.icon(`/x16/flux.png`)
    menuBar = commands.buildMenuBar
    content = EdgePane
    {
      top = EdgePane
      {
        left=InsetPane(2,2,2,2) { commands.buildToolBar }
        center=InsetPane(2,2,2,2) { buildLocatorBar }
      }
      center = SashPane
      {
        weights = [1, 3]
        buildSideBar
        buildViewTabPane
      }
    }
    commands.update
  }

  internal Widget buildLocatorBar() { return locator }

  internal Widget buildSideBar() { return NavSideBar {} }

  internal Widget buildViewTabPane() { return tabPane }

//////////////////////////////////////////////////////////////////////////
// Fields
//////////////////////////////////////////////////////////////////////////

  internal ViewTabPane tabPane := ViewTabPane(this)
  internal LocatorBar locator := LocatorBar(this)
  internal Commands commands := Commands(this)
}
