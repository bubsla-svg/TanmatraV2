import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { API_BASE } from "@/lib/apiBase";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";

const ADMIN_TOKEN_KEY = "tanmatra:admin-token:v1";

interface MenuItem {
  id: number;
  name: string;
  slug: string;
  category: string;
  kitchenLocation: string | null;
  pricePaise: number;
  isVeg: boolean;
  rdVerified: boolean;
  glycaemicIndex: string | null;
  allergenReviewState: string | null;
  unavailableUntil: string | null;
}

function rupees(paise: number): string {
  return `₹${(paise / 100).toLocaleString("en-IN", { maximumFractionDigits: 0 })}`;
}

export default function AdminCatalog() {
  const [adminToken, setAdminToken] = useState<string>(() =>
    typeof window === "undefined"
      ? ""
      : (window.localStorage.getItem(ADMIN_TOKEN_KEY) ?? ""),
  );
  const [items, setItems] = useState<MenuItem[]>([]);
  const [busy, setBusy] = useState(false);
  const [q, setQ] = useState("");
  
  // Editor state
  const [editItem, setEditItem] = useState<MenuItem | null>(null);
  const [formData, setFormData] = useState<Partial<MenuItem>>({});
  const [isNew, setIsNew] = useState(false);

  useEffect(() => {
    if (!adminToken) return;
    loadItems();
  }, [adminToken, q]);

  async function loadItems() {
    setBusy(true);
    try {
      const qs = q ? `?q=${encodeURIComponent(q)}` : "";
      const res = await fetch(`${API_BASE}/api/menu/items${qs}`, {
        headers: { "x-admin-token": adminToken },
      });
      if (res.ok) {
        const body = await res.json();
        setItems(body.items || []);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setBusy(false);
    }
  }

  function handleEdit(item: MenuItem) {
    setEditItem(item);
    setFormData(item);
    setIsNew(false);
  }

  function handleCreate() {
    setEditItem({
      id: 0,
      name: "",
      slug: "",
      category: "",
      kitchenLocation: null,
      pricePaise: 0,
      isVeg: false,
      rdVerified: false,
      glycaemicIndex: null,
      allergenReviewState: "pending_review",
      unavailableUntil: null
    });
    setFormData({
      name: "",
      category: "Meals",
      pricePaise: 0,
      isVeg: false
    });
    setIsNew(true);
  }

  async function saveItem() {
    if (!editItem) return;
    
    setBusy(true);
    try {
      if (isNew) {
        const res = await fetch(`${API_BASE}/api/menu/items`, {
          method: "POST",
          headers: { 
            "x-admin-token": adminToken,
            "Content-Type": "application/json"
          },
          body: JSON.stringify({
            name: formData.name,
            pricePaise: Number(formData.pricePaise) || 0,
            category: formData.category,
            isVeg: formData.isVeg,
            glycaemicIndex: formData.glycaemicIndex || undefined,
            allergenReviewState: formData.allergenReviewState || undefined,
            kitchenLocation: formData.kitchenLocation || undefined
          })
        });
        if (res.ok) {
          setEditItem(null);
          loadItems();
        } else {
          const body = await res.json();
          alert("Error: " + body.error);
        }
      } else {
        const res = await fetch(`${API_BASE}/api/menu/items/${editItem.slug}`, {
          method: "PATCH",
          headers: { 
            "x-admin-token": adminToken,
            "Content-Type": "application/json"
          },
          body: JSON.stringify({
            name: formData.name,
            category: formData.category,
            isVeg: formData.isVeg,
            glycaemicIndex: formData.glycaemicIndex || null,
            allergenReviewState: formData.allergenReviewState || undefined,
            kitchenLocation: formData.kitchenLocation || null
          })
        });
        if (res.ok) {
          setEditItem(null);
          loadItems();
        } else {
          const body = await res.json();
          alert("Error: " + body.error);
        }
      }
    } catch (err) {
      console.error(err);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Menu Catalog</h1>
          <p className="text-zinc-500">Manage SKUs, categories, and availability.</p>
        </div>
        <Button onClick={handleCreate}>+ Add Item</Button>
      </div>

      <Card>
        <CardHeader className="py-4 border-b">
          <div className="flex justify-between items-center">
            <CardTitle className="text-lg">Items</CardTitle>
            <Input 
              placeholder="Search SKUs..." 
              value={q}
              onChange={(e) => setQ(e.target.value)}
              className="w-64"
            />
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>SKU</TableHead>
                <TableHead>Category</TableHead>
                <TableHead>Price</TableHead>
                <TableHead>Attributes</TableHead>
                <TableHead>Status</TableHead>
                <TableHead></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {items.map((item) => (
                <TableRow key={item.id}>
                  <TableCell>
                    <div className="font-medium">{item.name}</div>
                    <div className="text-xs text-zinc-500 font-mono">{item.slug}</div>
                  </TableCell>
                  <TableCell>{item.category}</TableCell>
                  <TableCell>{rupees(item.pricePaise)}</TableCell>
                  <TableCell>
                    <div className="flex gap-2">
                      {item.isVeg && <Badge variant="secondary" className="bg-emerald-100 text-emerald-800">Veg</Badge>}
                      {/*
                        No "RD Verified" badge here. No dish carries a reviewer
                        id + review date, so rendering the claim would assert a
                        clinical review that never happened — banned by the
                        honest-claims gate (scripts/src/verify-honest-claims.ts).
                        `rdVerified` stays available for data/sort/filter logic;
                        only the rendered CLAIM is forbidden. If a real per-dish
                        review record is added, gate a badge on THAT, not on
                        this blanket boolean.
                      */}
                      {item.glycaemicIndex && (
                        <Badge variant="outline">
                          GI: {item.glycaemicIndex}
                        </Badge>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>
                    {item.allergenReviewState === "pending_review" ? (
                      <Badge variant="destructive">Allergen Pending</Badge>
                    ) : item.unavailableUntil && new Date(item.unavailableUntil) > new Date() ? (
                      <Badge variant="secondary" className="bg-amber-100 text-amber-800">Snoozed</Badge>
                    ) : (
                      <Badge variant="outline" className="border-emerald-200 text-emerald-700">Active</Badge>
                    )}
                  </TableCell>
                  <TableCell className="text-right">
                    <Button variant="ghost" size="sm" onClick={() => handleEdit(item)}>Edit</Button>
                  </TableCell>
                </TableRow>
              ))}
              {items.length === 0 && !busy && (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-8 text-zinc-500">
                    No items found.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Dialog open={!!editItem} onOpenChange={(open) => !open && setEditItem(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{isNew ? "Add Menu Item" : "Edit Menu Item"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Name</Label>
              <Input 
                value={formData.name || ""} 
                onChange={(e) => setFormData({ ...formData, name: e.target.value })} 
              />
            </div>
            {isNew && (
              <div className="space-y-2">
                <Label>Price (Paise)</Label>
                <Input 
                  type="number"
                  value={formData.pricePaise || 0} 
                  onChange={(e) => setFormData({ ...formData, pricePaise: parseInt(e.target.value) })} 
                />
              </div>
            )}
            <div className="space-y-2">
              <Label>Category</Label>
              <Input 
                value={formData.category || ""} 
                onChange={(e) => setFormData({ ...formData, category: e.target.value })} 
              />
            </div>
            <div className="space-y-2">
              <Label>Kitchen Location</Label>
              <Input 
                value={formData.kitchenLocation || ""} 
                placeholder="Leave blank for universal"
                onChange={(e) => setFormData({ ...formData, kitchenLocation: e.target.value })} 
              />
            </div>
            
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Glycaemic Index</Label>
                <Select 
                  value={formData.glycaemicIndex || "none"} 
                  onValueChange={(val: string) => setFormData({ ...formData, glycaemicIndex: val === "none" ? null : val })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select GI" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Not set</SelectItem>
                    <SelectItem value="low">Low</SelectItem>
                    <SelectItem value="medium">Medium</SelectItem>
                    <SelectItem value="high">High</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Allergen State</Label>
                <Select 
                  value={formData.allergenReviewState || "pending_review"} 
                  onValueChange={(val: string) => setFormData({ ...formData, allergenReviewState: val })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="State" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="pending_review">Pending</SelectItem>
                    <SelectItem value="reviewed">Reviewed</SelectItem>
                    <SelectItem value="blocked">Blocked</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="flex items-center space-x-2 pt-2">
              <Checkbox 
                id="isVeg" 
                checked={!!formData.isVeg} 
                onCheckedChange={(c: boolean) => setFormData({ ...formData, isVeg: !!c })}
              />
              <Label htmlFor="isVeg">Vegetarian</Label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditItem(null)}>Cancel</Button>
            <Button onClick={saveItem} disabled={busy}>Save</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
