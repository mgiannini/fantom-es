//
// Copyright (c) 2009, Brian Frank and Andy Frank
// Licensed under the Academic Free License version 3.0
//
// History:
//   8 Jan 09   Andy Frank  Creation
//   20 May 09  Andy Frank  Refactor to new OO model
//   8 Jul 09   Andy Frank  Split webappClient into sys/dom
//   10 Jun 2023  Kiera O'Flynn  Refactor to ES
//

class HttpReqPeer extends sys.Obj {

  constructor(self) { super(); }

  send(self, method, content, f)
  {
    const xhr = new XMLHttpRequest();
    let buf;
    let view;

    // attach progress listener if configured
    if (self.m_cbProgress != null)
    {
      let _p = xhr;
      const _m = method.toUpperCase();
      if (_m == "POST" || _m == "PUT") _p = xhr.upload
      _p.addEventListener("progress", function(e) {
        if (e.lengthComputable) self.m_cbProgress.call(e.loaded, e.total);
      });
    }

    // open request
    xhr.open(method.toUpperCase(), self.m_uri.encode(), self.m_async);
    if (self.m_async)
    {
      xhr.onreadystatechange = function ()
      {
        if (xhr.readyState == 4)
          f.call(HttpReqPeer.makeRes(xhr));
      }
    }

    // set response type
    xhr.responseType = self.m_resType;

    // setup headers
    let ct = false;
    const k = self.m_headers.keys();
    for (let i=0; i<k.size(); i++)
    {
      const key = k.get(i);
      if (fan.sys.Str.lower(key) == "content-type") ct = true;
      xhr.setRequestHeader(key, self.m_headers.get(key));
    }
    xhr.withCredentials = self.m_withCredentials;

    // send request based on content type
    if (content == null)
    {
      xhr.send(null);
    }
    else if (content instanceof FormData)
    {
      // send FormData (implicity adds Content-Type header)
      xhr.send(content);
    }
    else if (fan.sys.ObjUtil.$typeof(content) === fan.sys.Str.$type)
    {
      // send text
      if (!ct) xhr.setRequestHeader("Content-Type", "text/plain");
      xhr.send(content);
    }
    else if (content instanceof fan.sys.Buf)
    {
      // send binary
      if (!ct) xhr.setRequestHeader("Content-Type", "application/octet-stream");
      buf = new ArrayBuffer(content.size());
      view = new Uint8Array(buf);
      view.set(content.m_buf.slice(0, content.size()));
      xhr.send(view);
    }
    else if (content instanceof DomFile)
    {
      // send file as raw data
      xhr.send(content.peer.file);
    }
    else
    {
      throw fan.sys.Err.make("Can only send Str or Buf: " + content);
    }

    // for sync requests; directly invoke response handler
    if (!self.m_async) f.call(HttpReqPeer.makeRes(xhr));
  }

  static makeRes(xhr)
  {
    const isText = xhr.responseType == "" || xhr.responseType == "text";

    const res = HttpRes.make();
    res.m_$xhr    = xhr;
    res.m_status  = xhr.status;
    res.m_content = isText ? xhr.responseText : "";

    const all = xhr.getAllResponseHeaders().split("\n");
    for (const i=0; i<all.length; i++)
    {
      if (all[i].length == 0) continue;
      const j = all[i].indexOf(":");
      const k = fan.sys.Str.trim(all[i].substr(0, j));
      const v = fan.sys.Str.trim(all[i].substr(j+1));
      res.m_headers.set(k, v);
    }

    return res;
  }

  postForm(self, form, f)
  {
    // encode form content into urlencoded str
    let content = ""
    const k = form.keys();
    for (let i=0; i<k.size(); i++)
    {
      if (i > 0) content += "&";
      content += encodeURIComponent(k.get(i)) + "=" +
                 encodeURIComponent(form.get(k.get(i)));
    }
    // send POST request
    self.m_headers.set("Content-Type", "application/x-www-form-urlencoded");
    self.send("POST", content, f);
  }

  postFormMultipart(self, form, f)
  {
    // encode form map to FormData instance
    const data = new FormData();
    const keys = form.keys();
    for (let i=0; i<keys.size(); i++)
    {
      const k = keys.get(i);
      const v = form.get(k);
      if (v instanceof DomFile)
        data.append(k, v.peer.file, v.peer.file.name);
      else
        data.append(k, v);
    }
    // send POST request
    self.send("POST", data, f);
  }
}