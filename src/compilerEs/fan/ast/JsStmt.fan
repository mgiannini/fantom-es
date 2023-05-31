//
// Copyright (c) 2023, Brian Frank and Andy Frank
// Licensed under the Academic Free License version 3.0
//
// History:
//   15 May 2023  Matthew Giannini Creation
//

using compiler

**
** JsStmt
**
class JsStmt : JsNode
{
  new make(CompileEsPlugin plugin, Stmt stmt) : super(plugin, stmt)
  {
  }

  override Stmt? node() { super.node }
  Stmt stmt() { this.node }

  override Void write()
  {
    switch (stmt.id)
    {
      case StmtId.nop:          return
      case StmtId.expr:         writeExprStmt(stmt)
      case StmtId.localDef:     writeLocalDefStmt(stmt)
      case StmtId.ifStmt:       writeIfStmt(stmt)
      case StmtId.returnStmt:   writeReturnStmt(stmt)
      case StmtId.throwStmt:    writeThrowStmt(stmt)
      // case StmtId.continueStmt:
      default:
        stmt.print(AstWriter())
        throw err("Unknown StmtId: ${stmt.id} ${stmt.typeof}", stmt.loc)
    }
  }

//////////////////////////////////////////////////////////////////////////
// Expr
//////////////////////////////////////////////////////////////////////////

  private Void writeExprStmt(ExprStmt stmt)
  {
    writeExpr(stmt.expr)
  }

//////////////////////////////////////////////////////////////////////////
// LocalDef
//////////////////////////////////////////////////////////////////////////

  private Void writeLocalDefStmt(LocalDefStmt stmt)
  {
    js.w("let ", loc)
    if (stmt.init == null) js.w(stmt.name, loc)
    else
    {
      JsExpr(plugin, stmt.init) { it.isLocalDefStmt = true }.write
    }
  }

//////////////////////////////////////////////////////////////////////////
// If
//////////////////////////////////////////////////////////////////////////

  private Void writeIfStmt(IfStmt stmt)
  {
    js.w("if ("); writeExpr(stmt.condition); js.wl(") {")
    js.indent
    writeBlock(stmt.trueBlock)
    js.unindent.wl("}")
    if (stmt.falseBlock != null)
    {
      js.wl("else {")
      js.indent
      writeBlock(stmt.falseBlock)
      js.unindent.wl("}")
    }
  }

//////////////////////////////////////////////////////////////////////////
// Return
//////////////////////////////////////////////////////////////////////////

  private Void writeReturnStmt(ReturnStmt stmt)
  {
    js.w("return", loc)
    if (stmt.expr != null)
    {
      js.w(" ")
      writeExpr(stmt.expr)
    }
  }

//////////////////////////////////////////////////////////////////////////
// Throw
//////////////////////////////////////////////////////////////////////////

  private Void writeThrowStmt(ThrowStmt ts)
  {
    js.w("throw ")
    writeExpr(ts.exception)
  }
}