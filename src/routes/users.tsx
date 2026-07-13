import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api";
import { useState } from "react";
import { useAuth } from "@/lib/auth";
import { useStore } from "@/lib/store";

// Lucide Icons
import { Users as UsersIcon, User, Loader2, ShieldAlert, AlertCircle, Building2, Scale } from "lucide-react";

// Shadcn/UI Components
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";

export const Route = createFileRoute("/users")({
  head: () => ({
    meta: [
      { title: "User Management – Tracemark" },
      { name: "description", content: "Administrative panel for managing users." },
    ],
  }),
  component: UsersPage,
});

export interface UserProfile {
  id: string;
  email: string;
  full_name: string | null;
  organization_id: string | null;
  plan: string;
  is_admin: boolean;
  persona: string | null;
}

export function UsersPage() {
  const { user, profile } = useAuth();
  const setPersona = useStore((s) => s.setPersona);
  const queryClient = useQueryClient();
  const [filter, setFilter] = useState<"all" | "paying" | "free">("all");
  
  // Dialog state
  const [editingUser, setEditingUser] = useState<UserProfile | null>(null);
  const [selectedPlan, setSelectedPlan] = useState<string>("");
  const [selectedWorkspace, setSelectedWorkspace] = useState<string>("brand_owner");

  const isAdmin = !!profile?.is_admin;

  const { data: users, isLoading, isError } = useQuery({
    queryKey: ["admin-users"],
    queryFn: () => apiFetch<UserProfile[]>("/admin/users"),
    enabled: !!isAdmin,
  });

  const updatePlanMutation = useMutation({
    mutationFn: ({ userId, plan }: { userId: string; plan: string }) =>
      apiFetch<{ success: boolean; plan: string; is_admin: boolean }>(`/admin/users/${userId}/plan`, {
        method: "PUT",
        body: JSON.stringify({ plan }),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-users"] });
      setEditingUser(null);
    },
  });

  const updateWorkspaceMutation = useMutation({
    mutationFn: ({ userId, persona }: { userId: string; persona: string }) =>
      apiFetch<{ success: boolean; persona: string }>(`/admin/users/${userId}/workspace`, {
        method: "PUT",
        body: JSON.stringify({ persona }),
      }),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ["admin-users"] });
      // If the admin changed their own workspace, update the store immediately
      if (variables.userId === user?.id) {
        setPersona(variables.persona as any);
      }
    },
  });

  if (!isAdmin) {
    return (
      <div className="flex h-[80vh] flex-col items-center justify-center p-8 text-center space-y-4">
        <ShieldAlert className="h-16 w-16 text-destructive opacity-80" />
        <h2 className="text-2xl font-bold tracking-tight">Access Restricted</h2>
        <p className="text-muted-foreground max-w-[500px]">
          You do not have administrative privileges to view this page. If you believe this is an error, please contact support.
        </p>
      </div>
    );
  }

  const filteredUsers = users?.filter(u => {
    if (filter === "all") return true;
    if (filter === "paying") return u.plan !== "free";
    if (filter === "free") return u.plan === "free";
    return true;
  }) || [];

  const handleEditClick = (u: UserProfile) => {
    setEditingUser(u);
    setSelectedPlan(u.plan);
    setSelectedWorkspace(u.persona ?? "brand_owner");
  };

  const handleSavePlan = () => {
    if (!editingUser || !selectedPlan) return;
    updatePlanMutation.mutate({ userId: editingUser.id, plan: selectedPlan });
    // Save workspace if org exists and changed
    if (editingUser.organization_id && selectedWorkspace !== (editingUser.persona ?? "brand_owner")) {
      updateWorkspaceMutation.mutate({ userId: editingUser.id, persona: selectedWorkspace });
    }
  };

  return (
    <div className="mx-auto w-full max-w-7xl p-4 md:p-8 space-y-8 animate-in fade-in zoom-in-95 duration-500">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="space-y-1">
          <h1 className="text-3xl font-bold tracking-tight text-foreground flex items-center gap-2">
            <UsersIcon className="h-7 w-7 text-accent" />
            User Management
          </h1>
          <p className="text-muted-foreground">
            View registered users, manage subscription plans and workspace types.
          </p>
        </div>
      </div>

      <Card className="border-border/40 bg-card/60 backdrop-blur-md">
        <CardHeader className="flex flex-col sm:flex-row sm:items-center justify-between pb-4 gap-4">
          <div className="space-y-1.5">
            <CardTitle>Registered Users</CardTitle>
            <CardDescription>
              {isLoading ? "Loading users..." : `Found ${filteredUsers.length} user(s)`}
            </CardDescription>
          </div>
          
          <div className="w-[180px]">
            <Select value={filter} onValueChange={(val: any) => setFilter(val)}>
              <SelectTrigger className="w-full bg-background/50">
                <SelectValue placeholder="Filter users" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Users</SelectItem>
                <SelectItem value="paying">Paying Users</SelectItem>
                <SelectItem value="free">Free Users</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardHeader>
        
        <CardContent>
          {isLoading ? (
            <div className="space-y-3">
              {[1, 2, 3, 4].map((i) => (
                <Skeleton key={i} className="h-12 w-full rounded-md" />
              ))}
            </div>
          ) : isError ? (
            <div className="flex h-32 flex-col items-center justify-center text-center p-4 border border-dashed border-destructive/50 rounded-lg bg-destructive/5">
              <AlertCircle className="h-8 w-8 text-destructive mb-2" />
              <p className="text-sm font-medium text-destructive">Failed to load users.</p>
              <Button 
                variant="outline" 
                size="sm" 
                className="mt-4" 
                onClick={() => queryClient.invalidateQueries({ queryKey: ["admin-users"] })}
              >
                Try Again
              </Button>
            </div>
          ) : filteredUsers.length === 0 ? (
            <div className="flex h-32 flex-col items-center justify-center text-center p-4 border border-dashed border-border/50 rounded-lg bg-muted/10">
              <User className="h-8 w-8 text-muted-foreground/50 mb-2" />
              <p className="text-sm font-medium text-muted-foreground">No users match the current filter.</p>
            </div>
          ) : (
            <div className="rounded-md border border-border/40 overflow-hidden">
              <Table>
                <TableHeader className="bg-muted/30">
                  <TableRow className="hover:bg-transparent">
                    <TableHead>User</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Plan</TableHead>
                    <TableHead>Workspace</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredUsers.map((u) => (
                    <TableRow key={u.id} className="group hover:bg-muted/10">
                      <TableCell className="font-medium">
                        {u.full_name || <span className="text-muted-foreground italic">No Name</span>}
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {u.email}
                      </TableCell>
                      <TableCell>
                        {u.plan !== "free" ? (
                          <Badge variant="default" className="bg-emerald-500/10 text-emerald-500 hover:bg-emerald-500/20 border-emerald-500/20">
                            Paying
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="text-muted-foreground">
                            Free
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell>
                        <Badge variant="secondary" className="capitalize">
                          {u.plan}
                        </Badge>
                        {u.is_admin && (
                          <Badge variant="outline" className="ml-2 border-accent/30 text-accent bg-accent/5">
                            Admin
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell>
                        {u.persona === "law_firm" ? (
                          <Badge variant="outline" className="gap-1 border-indigo-500/30 text-indigo-400 bg-indigo-500/5">
                            <Scale className="h-3 w-3" /> Law Firm
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="gap-1 border-teal-500/30 text-teal-400 bg-teal-500/5">
                            <Building2 className="h-3 w-3" /> Brand Owner
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        <Button 
                          variant="ghost" 
                          size="sm" 
                          onClick={() => handleEditClick(u)}
                          className="h-8 px-2 text-muted-foreground hover:text-foreground"
                        >
                          Edit Plan
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={!!editingUser} onOpenChange={(open) => !open && setEditingUser(null)}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Edit User Plan</DialogTitle>
            <DialogDescription>
              Change the subscription plan for {editingUser?.email}.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <label htmlFor="plan" className="text-sm font-medium">Subscription Tier</label>
              <Select value={selectedPlan} onValueChange={setSelectedPlan}>
                <SelectTrigger id="plan" className="w-full">
                  <SelectValue placeholder="Select a plan" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="free">Free</SelectItem>
                  <SelectItem value="starter">Starter</SelectItem>
                  <SelectItem value="growth">Growth</SelectItem>
                  <SelectItem value="pro">Pro</SelectItem>
                  <SelectItem value="agency">Agency</SelectItem>
                  <SelectItem value="enterprise">Enterprise</SelectItem>
                  <SelectItem value="admin">Admin</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-2">
              <label htmlFor="workspace" className="text-sm font-medium">Workspace Type</label>
              <Select value={selectedWorkspace} onValueChange={setSelectedWorkspace} disabled={!editingUser?.organization_id}>
                <SelectTrigger id="workspace" className="w-full">
                  <SelectValue placeholder="Select workspace" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="brand_owner">
                    <span className="flex items-center gap-2">
                      <Building2 className="h-3.5 w-3.5" /> Brand Owner
                    </span>
                  </SelectItem>
                  <SelectItem value="law_firm">
                    <span className="flex items-center gap-2">
                      <Scale className="h-3.5 w-3.5" /> Law Firm
                    </span>
                  </SelectItem>
                </SelectContent>
              </Select>
              {!editingUser?.organization_id && (
                <p className="text-xs text-muted-foreground">User has no organization assigned — workspace cannot be changed.</p>
              )}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditingUser(null)}>Cancel</Button>
            <Button onClick={handleSavePlan} disabled={updatePlanMutation.isPending}>
              {updatePlanMutation.isPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Saving...
                </>
              ) : (
                "Save changes"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
