import { useOpsAgent } from "@/components/ops/useOpsAgent";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Separator } from "@/components/ui/separator";
import { formatCurrency } from "@/lib/utils";
import DecisionsTable from "@/components/ops/DecisionsTable";
import EtaAccuracyPanel from "@/components/ops/EtaAccuracyPanel";
import DispatchPanel from "@/components/ops/DispatchPanel";
import AnomaliesPanel from "@/components/ops/AnomaliesPanel";
import RefundsPanel from "@/components/ops/RefundsPanel";
import {
  Send,
  Bot,
  User,
  Wrench,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  ShieldAlert,
  Clock,
  ArrowUpRight,
  Activity,
} from "lucide-react";

export default function AdminOpsDashboard() {
  const {
    input,
    setInput,
    messages,
    pendingActions,
    confirmDialog,
    setConfirmDialog,
    actionHistory,
    scrollRef,
    streaming,
    streamingIdRef,
    handleSend,
    handleConfirmAction,
    handleKeyDown,
    pendingCount,
    highRiskCount,
  } = useOpsAgent();

  return (
    <div className="h-[calc(100vh-4rem)] flex gap-4 p-4 animate-in fade-in duration-500">
      <div className="flex-1 flex flex-col min-w-0">
        <Card className="flex-1 flex flex-col border-2 border-nn-primary/20">
          <CardHeader className="shrink-0 py-3 px-4 border-b bg-nn-bg">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-full bg-nn-primary/20 flex items-center justify-center">
                  <Bot className="w-5 h-5 text-nn-primary" />
                </div>
                <div>
                  <CardTitle className="text-sm text-white">Ops Agent</CardTitle>
                  <p className="text-[10px] text-muted-foreground font-mono">
                    Execution-capable · Confirmation required for destructive ops
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                {pendingCount > 0 && (
                  <Badge variant="outline" className="border-orange-500/30 text-orange-400 gap-1">
                    <ShieldAlert className="w-3 h-3" />
                    {pendingCount} pending
                  </Badge>
                )}
                <Badge variant="outline" className="border-green-500/30 text-green-400 text-[10px]">
                  Online
                </Badge>
              </div>
            </div>
          </CardHeader>

          <ScrollArea className="flex-1 p-4" ref={scrollRef as any}>
            <div className="space-y-4">
              {messages.map((msg) => (
                <div key={msg.id} className={`flex gap-2 ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
                  {msg.role === "agent" && (
                    <div className="w-6 h-6 rounded-full bg-nn-primary/10 flex items-center justify-center shrink-0 mt-1">
                      <Bot className="w-3 h-3 text-nn-primary" />
                    </div>
                  )}
                  <div
                    className={`max-w-[80%] rounded-lg px-3 py-2 text-sm ${
                      msg.role === "user" ? "bg-nn-tertiary text-white" : "bg-muted text-foreground"
                    }`}
                  >
                    <p className="whitespace-pre-wrap">{msg.text}</p>
                    {msg.toolCalls && msg.toolCalls.length > 0 && (
                      <div className="mt-2 space-y-1">
                        {msg.toolCalls.map((tc, ti) => {
                          const isDestructive = ["refund_payment", "cancel_order", "update_inventory"].includes(tc.name);
                          return (
                            <div
                              key={ti}
                              className={`flex items-center gap-1.5 text-[10px] rounded px-2 py-1 ${
                                isDestructive
                                  ? "bg-orange-500/10 text-orange-400"
                                  : "bg-background/50 text-muted-foreground"
                              }`}
                            >
                              <Wrench className="w-3 h-3" />
                              <span className="font-mono">{tc.name}</span>
                              {isDestructive && <ShieldAlert className="w-3 h-3 text-orange-400" />}
                              {(tc.result as { success?: boolean } | undefined)?.success ? (
                                <CheckCircle2 className="w-3 h-3 text-green-500" />
                              ) : (
                                <XCircle className="w-3 h-3 text-red-500" />
                              )}
                            </div>
                          );
                        })}
                      </div>
                    )}
                    {msg.escalated && (
                      <div className="mt-2 flex items-center gap-1 text-[10px] text-orange-400">
                        <ArrowUpRight className="w-3 h-3" />
                        Escalated to human
                      </div>
                    )}
                    <p className="text-[10px] opacity-60 mt-1 text-right">{msg.timestamp}</p>
                  </div>
                  {msg.role === "user" && (
                    <div className="w-6 h-6 rounded-full bg-nn-tertiary/10 flex items-center justify-center shrink-0 mt-1">
                      <User className="w-3 h-3 text-nn-tertiary" />
                    </div>
                  )}
                </div>
              ))}
              {streaming &&
                messages.find((m) => m.id === streamingIdRef.current)?.text ===
                  "" && (
                  <div className="flex gap-2">
                    <div className="w-6 h-6 rounded-full bg-nn-primary/10 flex items-center justify-center">
                      <Bot className="w-3 h-3 text-nn-primary animate-bounce" />
                    </div>
                    <div className="bg-muted rounded-lg px-3 py-2 text-sm text-muted-foreground">
                      Analyzing...
                    </div>
                  </div>
                )}
            </div>
          </ScrollArea>

          <CardContent className="shrink-0 p-3 border-t">
            <div className="flex gap-2">
              <Input
                placeholder={"Ask the Ops Agent: check inventory, assign rider, refund order #" + "123..."}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                className="flex-1"
                aria-label="Ops agent chat input"
              />
              <Button
                size="icon"
                onClick={handleSend}
                disabled={!input.trim() || streaming}
                aria-label="Send message"
              >
                <Send className="w-4 h-4" />
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="w-80 shrink-0 space-y-4 hidden lg:flex lg:flex-col">
        <Card className={pendingCount > 0 ? "border-orange-500/30" : ""}>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <ShieldAlert className="w-4 h-4" />
              Pending Confirmations
              {highRiskCount > 0 && (
                <Badge variant="destructive" className="text-[10px]">
                  {highRiskCount} high risk
                </Badge>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {pendingActions.length === 0 ? (
              <p className="text-sm text-muted-foreground italic">No actions awaiting confirmation.</p>
            ) : (
              <div className="space-y-2">
                {pendingActions.map((action) => (
                  <div
                    key={action.id}
                    className={`flex items-center justify-between p-2 rounded-md text-xs ${
                      action.riskScore >= 0.7
                        ? "bg-orange-500/10 border border-orange-500/20"
                        : "bg-muted/50"
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <AlertTriangle
                        className={`w-3 h-3 ${
                          action.riskScore >= 0.7 ? "text-orange-400" : "text-muted-foreground"
                        }`}
                      />
                      <span className="font-medium capitalize">{action.actionType.replace("_", " ")}</span>
                    </div>
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-6 text-[10px]"
                      onClick={() => setConfirmDialog(action)}
                    >
                      Review
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <Clock className="w-4 h-4" />
              Recent Decisions
            </CardTitle>
          </CardHeader>
          <CardContent>
            <DecisionsTable
              rows={actionHistory.map((h) => ({
                id: h.id,
                actionType: h.actionType,
                riskScore: h.riskScore,
                approved: h.approved,
                decidedAt: h.decidedAt,
              }))}
            />
          </CardContent>
        </Card>

        <EtaAccuracyPanel />

        <DispatchPanel />

        <RefundsPanel />

        <AnomaliesPanel
          onOpenAgent={(prompt) => {
            setInput(prompt);
            if (typeof window !== "undefined") {
              window.scrollTo({ top: 0, behavior: "smooth" });
            }
          }}
        />

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <Activity className="w-4 h-4" />
              Live Ops
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Active Orders</span>
              <span className="font-bold">-</span>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Riders Online</span>
              <span className="font-bold">-</span>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Avg Delivery</span>
              <span className="font-bold">18 min</span>
            </div>
            <Separator />
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Revenue Today</span>
              <span className="font-bold text-nn-primary">{formatCurrency(0)}</span>
            </div>
          </CardContent>
        </Card>
      </div>

      <Dialog open={!!confirmDialog} onOpenChange={(open) => !open && setConfirmDialog(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-orange-400">
              <ShieldAlert className="w-5 h-5" />
              Confirm Destructive Action
            </DialogTitle>
            <DialogDescription>
              The Ops Agent has requested a <strong>{confirmDialog?.actionType.replace("_", " ")}</strong> that
              may have financial or operational impact. Review before confirming.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3 my-2">
            <div className="bg-muted/50 rounded-md p-3 space-y-1">
              <p className="text-xs text-muted-foreground">Action Type</p>
              <p className="text-sm font-mono font-medium">{confirmDialog?.actionType}</p>
            </div>
            <div className="bg-muted/50 rounded-md p-3 space-y-1">
              <p className="text-xs text-muted-foreground">Description</p>
              <p className="text-sm font-mono">{confirmDialog?.description}</p>
            </div>
            <div className="bg-muted/50 rounded-md p-3 space-y-1">
              <p className="text-xs text-muted-foreground">Risk Score</p>
              <div className="flex items-center gap-2">
                <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full ${
                      (confirmDialog?.riskScore ?? 0) >= 0.8 ? "bg-red-500" : "bg-orange-500"
                    }`}
                    style={{ width: `${(confirmDialog?.riskScore ?? 0) * 100}%` }}
                  />
                </div>
                <span className="text-xs font-mono">
                  {((confirmDialog?.riskScore ?? 0) * 100).toFixed(0)}%
                </span>
              </div>
            </div>
          </div>

          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => handleConfirmAction(false)}>
              Reject
            </Button>
            <Button
              variant="default"
              onClick={() => handleConfirmAction(true)}
              className="bg-orange-500 hover:bg-orange-600 text-white"
            >
              Approve & Execute
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
