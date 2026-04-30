import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/context/AuthContext';
import { ROUTES } from '@/lib/routes';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import { toast } from 'sonner';
import { LogOut, Search, Plus, Trash2, Pencil, Ban, ShieldCheck, Coins, Users, Activity, DollarSign } from 'lucide-react';

interface AdminUser {
  id: string;
  email: string;
  credits: number;
  is_blocked: boolean;
  blocked_reason: string | null;
  created_at: string;
}

interface Plan {
  id: string;
  name: string;
  credits: number;
  usd_price: number;
  created_at?: string;
}

interface AdminStats {
  total_users: number;
  blocked_users: number;
  total_credits: number;
  total_revenue: number;
  active_sessions: number;
}

interface AuditEntry {
  id: string;
  actor_id: string | null;
  action: string;
  target_table: string | null;
  target_id: string | null;
  payload: any;
  created_at: string;
}

export default function AdminDashboard() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const [stats, setStats] = useState<AdminStats | null>(null);
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [plans, setPlans] = useState<Plan[]>([]);
  const [audit, setAudit] = useState<AuditEntry[]>([]);
  const [search, setSearch] = useState('');
  const [loadingUsers, setLoadingUsers] = useState(false);
  const [loadingPlans, setLoadingPlans] = useState(false);

  // Credits dialog
  const [creditsOpen, setCreditsOpen] = useState(false);
  const [creditsTarget, setCreditsTarget] = useState<AdminUser | null>(null);
  const [creditsValue, setCreditsValue] = useState('0');
  const [creditsReason, setCreditsReason] = useState('');

  // Block dialog
  const [blockOpen, setBlockOpen] = useState(false);
  const [blockTarget, setBlockTarget] = useState<AdminUser | null>(null);
  const [blockReason, setBlockReason] = useState('');

  // Plan editor
  const [planOpen, setPlanOpen] = useState(false);
  const [editingPlan, setEditingPlan] = useState<Plan | null>(null);
  const [planForm, setPlanForm] = useState<{ name: string; credits: string; usd_price: string }>({
    name: '', credits: '', usd_price: '',
  });

  const loadStats = useCallback(async () => {
    const { data, error } = await supabase.rpc('admin_stats');
    if (error) {
      toast.error('Stats error: ' + error.message);
      return;
    }
    setStats(data as AdminStats);
  }, []);

  const loadUsers = useCallback(async (q: string = '') => {
    setLoadingUsers(true);
    const { data, error } = await supabase.rpc('admin_list_users', {
      p_search: q || null, p_limit: 200, p_offset: 0,
    });
    setLoadingUsers(false);
    if (error) {
      toast.error('Users error: ' + error.message);
      return;
    }
    setUsers((data as AdminUser[]) || []);
  }, []);

  const loadPlans = useCallback(async () => {
    setLoadingPlans(true);
    const { data, error } = await supabase
      .from('plans')
      .select('*')
      .order('usd_price', { ascending: true });
    setLoadingPlans(false);
    if (error) {
      toast.error('Plans error: ' + error.message);
      return;
    }
    setPlans((data as Plan[]) || []);
  }, []);

  const loadAudit = useCallback(async () => {
    const { data, error } = await supabase
      .from('audit_log')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(100);
    if (error) {
      // not critical, ignore silently
      return;
    }
    setAudit((data as AuditEntry[]) || []);
  }, []);

  useEffect(() => {
    void loadStats();
    void loadUsers();
    void loadPlans();
    void loadAudit();
  }, [loadStats, loadUsers, loadPlans, loadAudit]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    void loadUsers(search.trim());
  };

  // ---- Credits ----
  const openCredits = (u: AdminUser) => {
    setCreditsTarget(u);
    setCreditsValue(String(u.credits));
    setCreditsReason('');
    setCreditsOpen(true);
  };

  const submitCredits = async () => {
    if (!creditsTarget) return;
    const credits = Math.max(0, Math.floor(Number(creditsValue) || 0));
    const { error } = await supabase.rpc('admin_set_credits', {
      p_user_id: creditsTarget.id,
      p_credits: credits,
      p_reason: creditsReason || null,
    });
    if (error) {
      toast.error('Failed: ' + error.message);
      return;
    }
    toast.success(`Set credits to ${credits} for ${creditsTarget.email}`);
    setCreditsOpen(false);
    void loadUsers(search.trim());
    void loadStats();
    void loadAudit();
  };

  // ---- Block ----
  const openBlock = (u: AdminUser) => {
    setBlockTarget(u);
    setBlockReason('');
    setBlockOpen(true);
  };

  const submitBlock = async (blocked: boolean) => {
    if (!blockTarget) return;
    const { error } = await supabase.rpc('admin_set_blocked', {
      p_user_id: blockTarget.id,
      p_blocked: blocked,
      p_reason: blocked ? (blockReason || null) : null,
    });
    if (error) {
      toast.error('Failed: ' + error.message);
      return;
    }
    toast.success(blocked ? 'User blocked' : 'User unblocked');
    setBlockOpen(false);
    void loadUsers(search.trim());
    void loadStats();
    void loadAudit();
  };

  const quickToggleBlock = async (u: AdminUser) => {
    if (u.is_blocked) {
      const { error } = await supabase.rpc('admin_set_blocked', {
        p_user_id: u.id, p_blocked: false, p_reason: null,
      });
      if (error) { toast.error(error.message); return; }
      toast.success('User unblocked');
      void loadUsers(search.trim());
      void loadStats();
      void loadAudit();
    } else {
      openBlock(u);
    }
  };

  // ---- Plans ----
  const openPlanCreate = () => {
    setEditingPlan(null);
    setPlanForm({ name: '', credits: '', usd_price: '' });
    setPlanOpen(true);
  };
  const openPlanEdit = (p: Plan) => {
    setEditingPlan(p);
    setPlanForm({ name: p.name, credits: String(p.credits), usd_price: String(p.usd_price) });
    setPlanOpen(true);
  };
  const submitPlan = async () => {
    const credits = Math.max(0, Math.floor(Number(planForm.credits) || 0));
    const price = Math.max(0, Number(planForm.usd_price) || 0);
    if (!planForm.name.trim()) { toast.error('Name required'); return; }

    const { error } = await supabase.rpc('admin_upsert_plan', {
      p_id: editingPlan?.id ?? null,
      p_name: planForm.name.trim(),
      p_credits: credits,
      p_usd_price: price,
    });
    if (error) { toast.error('Failed: ' + error.message); return; }
    toast.success(editingPlan ? 'Plan updated' : 'Plan created');
    setPlanOpen(false);
    void loadPlans();
    void loadAudit();
  };
  const deletePlan = async (p: Plan) => {
    if (!confirm(`Delete plan "${p.name}"?`)) return;
    const { error } = await supabase.rpc('admin_delete_plan', { p_id: p.id });
    if (error) { toast.error('Failed: ' + error.message); return; }
    toast.success('Plan deleted');
    void loadPlans();
    void loadAudit();
  };

  const handleSignOut = async () => {
    await logout();
    navigate(ROUTES.PUBLIC.LOGIN, { replace: true });
  };

  const statCards = useMemo(() => ([
    { label: 'Total Users',     value: stats?.total_users ?? '—',     icon: Users },
    { label: 'Blocked',         value: stats?.blocked_users ?? '—',   icon: Ban },
    { label: 'Total Credits',   value: stats?.total_credits ?? '—',   icon: Coins },
    { label: 'Revenue (NGN)',   value: stats ? Number(stats.total_revenue).toLocaleString() : '—', icon: DollarSign },
    { label: 'Active Sessions', value: stats?.active_sessions ?? '—', icon: Activity },
  ]), [stats]);

  return (
    <div className="min-h-screen bg-[#09090b] text-white p-6 lg:p-10">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-2xl font-bold">Surevideotool Admin</h1>
              <p className="text-sm text-zinc-400">Signed in as {user?.email}</p>
            </div>
          </div>
          <Button variant="outline" onClick={handleSignOut}>
            <LogOut className="w-4 h-4 mr-2" /> Sign out
          </Button>
        </div>

        {/* Stat Cards */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          {statCards.map((s) => {
            const Icon = s.icon;
            return (
              <Card key={s.label} className="bg-[#111114] border-zinc-800">
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-xs text-zinc-400">{s.label}</p>
                      <p className="text-xl font-semibold mt-1">{s.value}</p>
                    </div>
                    <Icon className="w-5 h-5 text-zinc-500" />
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>

        {/* Tabs */}
        <Tabs defaultValue="users">
          <TabsList className="bg-[#111114] border border-zinc-800">
            <TabsTrigger value="users">Users</TabsTrigger>
            <TabsTrigger value="pricing">Pricing</TabsTrigger>
            <TabsTrigger value="audit">Audit Log</TabsTrigger>
          </TabsList>

          {/* USERS */}
          <TabsContent value="users" className="mt-4">
            <Card className="bg-[#111114] border-zinc-800">
              <CardHeader>
                <CardTitle>Users</CardTitle>
                <CardDescription>Edit credits, block or unblock accounts.</CardDescription>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleSearch} className="flex gap-2 mb-4">
                  <div className="relative flex-1">
                    <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" />
                    <Input
                      value={search}
                      onChange={(e) => setSearch(e.target.value)}
                      placeholder="Search by email"
                      className="pl-9"
                    />
                  </div>
                  <Button type="submit">Search</Button>
                  <Button type="button" variant="outline" onClick={() => { setSearch(''); void loadUsers(''); }}>
                    Reset
                  </Button>
                </form>

                <div className="rounded-lg border border-zinc-800 overflow-hidden">
                  <Table>
                    <TableHeader>
                      <TableRow className="hover:bg-transparent">
                        <TableHead>Email</TableHead>
                        <TableHead className="text-right">Credits</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Joined</TableHead>
                        <TableHead className="text-right">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {loadingUsers && (
                        <TableRow><TableCell colSpan={5} className="text-center text-zinc-500">Loading…</TableCell></TableRow>
                      )}
                      {!loadingUsers && users.length === 0 && (
                        <TableRow><TableCell colSpan={5} className="text-center text-zinc-500">No users</TableCell></TableRow>
                      )}
                      {users.map((u) => (
                        <TableRow key={u.id}>
                          <TableCell className="font-medium">{u.email}</TableCell>
                          <TableCell className="text-right">{u.credits}</TableCell>
                          <TableCell>
                            {u.is_blocked
                              ? <Badge variant="destructive">Blocked</Badge>
                              : <Badge variant="secondary">Active</Badge>}
                          </TableCell>
                          <TableCell className="text-zinc-400 text-xs">
                            {u.created_at ? new Date(u.created_at).toLocaleDateString() : '—'}
                          </TableCell>
                          <TableCell className="text-right">
                            <div className="inline-flex gap-2">
                              <Button size="sm" variant="outline" onClick={() => openCredits(u)}>
                                <Coins className="w-4 h-4 mr-1" /> Credits
                              </Button>
                              <Button
                                size="sm"
                                variant={u.is_blocked ? 'secondary' : 'destructive'}
                                onClick={() => quickToggleBlock(u)}
                              >
                                <Ban className="w-4 h-4 mr-1" />
                                {u.is_blocked ? 'Unblock' : 'Block'}
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* PRICING */}
          <TabsContent value="pricing" className="mt-4">
            <Card className="bg-[#111114] border-zinc-800">
              <CardHeader className="flex flex-row items-center justify-between">
                <div>
                  <CardTitle>Pricing Plans</CardTitle>
                  <CardDescription>Edit credits and price for each plan.</CardDescription>
                </div>
                <Button onClick={openPlanCreate}><Plus className="w-4 h-4 mr-1" /> New Plan</Button>
              </CardHeader>
              <CardContent>
                <div className="rounded-lg border border-zinc-800 overflow-hidden">
                  <Table>
                    <TableHeader>
                      <TableRow className="hover:bg-transparent">
                        <TableHead>Name</TableHead>
                        <TableHead className="text-right">Credits</TableHead>
                        <TableHead className="text-right">Price (USD)</TableHead>
                        <TableHead className="text-right">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {loadingPlans && (
                        <TableRow><TableCell colSpan={4} className="text-center text-zinc-500">Loading…</TableCell></TableRow>
                      )}
                      {!loadingPlans && plans.length === 0 && (
                        <TableRow><TableCell colSpan={4} className="text-center text-zinc-500">No plans</TableCell></TableRow>
                      )}
                      {plans.map((p) => (
                        <TableRow key={p.id}>
                          <TableCell className="font-medium">{p.name}</TableCell>
                          <TableCell className="text-right">{p.credits}</TableCell>
                          <TableCell className="text-right">${Number(p.usd_price).toFixed(2)}</TableCell>
                          <TableCell className="text-right">
                            <div className="inline-flex gap-2">
                              <Button size="sm" variant="outline" onClick={() => openPlanEdit(p)}>
                                <Pencil className="w-4 h-4 mr-1" /> Edit
                              </Button>
                              <Button size="sm" variant="destructive" onClick={() => deletePlan(p)}>
                                <Trash2 className="w-4 h-4 mr-1" /> Delete
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* AUDIT */}
          <TabsContent value="audit" className="mt-4">
            <Card className="bg-[#111114] border-zinc-800">
              <CardHeader>
                <CardTitle>Audit Log</CardTitle>
                <CardDescription>Recent admin actions.</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="rounded-lg border border-zinc-800 overflow-hidden">
                  <Table>
                    <TableHeader>
                      <TableRow className="hover:bg-transparent">
                        <TableHead>When</TableHead>
                        <TableHead>Action</TableHead>
                        <TableHead>Target</TableHead>
                        <TableHead>Payload</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {audit.length === 0 && (
                        <TableRow><TableCell colSpan={4} className="text-center text-zinc-500">No entries</TableCell></TableRow>
                      )}
                      {audit.map((a) => (
                        <TableRow key={a.id}>
                          <TableCell className="text-xs text-zinc-400">
                            {new Date(a.created_at).toLocaleString()}
                          </TableCell>
                          <TableCell><Badge variant="secondary">{a.action}</Badge></TableCell>
                          <TableCell className="text-xs">
                            {a.target_table}:{a.target_id?.slice(0, 8)}
                          </TableCell>
                          <TableCell className="text-xs text-zinc-400 max-w-md truncate">
                            {a.payload ? JSON.stringify(a.payload) : ''}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>

      {/* Edit credits dialog */}
      <Dialog open={creditsOpen} onOpenChange={setCreditsOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit credits</DialogTitle>
            <DialogDescription>{creditsTarget?.email}</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>New credit balance</Label>
              <Input
                type="number" min={0} step={1}
                value={creditsValue}
                onChange={(e) => setCreditsValue(e.target.value)}
              />
            </div>
            <div>
              <Label>Reason (optional)</Label>
              <Input value={creditsReason} onChange={(e) => setCreditsReason(e.target.value)} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreditsOpen(false)}>Cancel</Button>
            <Button onClick={submitCredits}>Save</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Block dialog */}
      <Dialog open={blockOpen} onOpenChange={setBlockOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Block user</DialogTitle>
            <DialogDescription>{blockTarget?.email}</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <Label>Reason</Label>
            <Input value={blockReason} onChange={(e) => setBlockReason(e.target.value)} placeholder="e.g. Abuse" />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setBlockOpen(false)}>Cancel</Button>
            <Button variant="destructive" onClick={() => submitBlock(true)}>Block</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Plan dialog */}
      <Dialog open={planOpen} onOpenChange={setPlanOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingPlan ? 'Edit plan' : 'New plan'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>Name</Label>
              <Input value={planForm.name} onChange={(e) => setPlanForm({ ...planForm, name: e.target.value })} />
            </div>
            <div>
              <Label>Credits</Label>
              <Input type="number" min={0} value={planForm.credits}
                onChange={(e) => setPlanForm({ ...planForm, credits: e.target.value })} />
            </div>
            <div>
              <Label>Price (USD)</Label>
              <Input type="number" min={0} step="0.01" value={planForm.usd_price}
                onChange={(e) => setPlanForm({ ...planForm, usd_price: e.target.value })} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPlanOpen(false)}>Cancel</Button>
            <Button onClick={submitPlan}>{editingPlan ? 'Save' : 'Create'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
