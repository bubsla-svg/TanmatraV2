import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { API_BASE } from "@/lib/apiBase";


const ADMIN_TOKEN_KEY = "tanmatra:admin-token:v1";

interface Asset {
  id: number;
  slug: string;
  kind: string; // "original", "enhanced", "no-bg", "ai-hero"
  publicUrl: string;
  isPrimary: boolean;
  isAiGenerated: boolean;
  createdAt: string;
}

interface MissingItem {
  name: string;
  slug: string;
  category: string;
  kitchenLocation: string | null;
}

export default function AdminMenuImagery() {
  const [adminToken] = useState<string>(() =>
    typeof window === "undefined" ? "" : (window.localStorage.getItem(ADMIN_TOKEN_KEY) ?? ""),
  );
  
  const [busy, setBusy] = useState(false);
  const [slugSearch, setSlugSearch] = useState("");
  const [activeSlug, setActiveSlug] = useState("");
  const [assets, setAssets] = useState<Asset[]>([]);
  
  const [missingItems, setMissingItems] = useState<MissingItem[]>([]);
  const [bulkBusy, setBulkBusy] = useState(false);
  const [bulkProgress, setBulkProgress] = useState<string[]>([]);
  
  const [heroPrompt, setHeroPrompt] = useState("");
  const [fileToUpload, setFileToUpload] = useState<File | null>(null);

  useEffect(() => {
    loadMissing();
  }, []);

  async function loadMissing() {
    setBusy(true);
    try {
      const res = await fetch(`${API_BASE}/menu/items/missing-images`, {
        headers: { "x-admin-token": adminToken },
        credentials: "include",
      });
      if (res.ok) {
        const data = await res.json();
        setMissingItems(data.items || []);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setBusy(false);
    }
  }

  async function loadAssets(slug: string) {
    if (!slug) return;
    setBusy(true);
    try {
      const res = await fetch(`${API_BASE}/menu/items/${slug}/assets`, {
        headers: { "x-admin-token": adminToken },
        credentials: "include",
      });
      if (res.ok) {
        const data = await res.json();
        setAssets(data.assets || []);
        setActiveSlug(slug);
      } else {
        alert("Failed to load assets for " + slug);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setBusy(false);
    }
  }

  async function handleAssetAction(assetId: number, action: string) {
    setBusy(true);
    try {
      let method = "POST";
      if (action === "delete") method = "DELETE";
      
      const endpoint = action === "delete" 
        ? `${API_BASE}/menu/assets/${assetId}`
        : `${API_BASE}/menu/assets/${assetId}/${action}`;

      const res = await fetch(endpoint, {
        method,
        headers: { "x-admin-token": adminToken },
        credentials: "include",
      });
      
      if (res.ok) {
        loadAssets(activeSlug);
        if (action === "set-primary") {
          loadMissing(); // refresh missing list
        }
      } else {
        const err = await res.json();
        alert("Error: " + err.error);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setBusy(false);
    }
  }

  async function handleGenerateHero() {
    if (!activeSlug) return;
    setBusy(true);
    try {
      const res = await fetch(`${API_BASE}/menu/items/${activeSlug}/assets/hero`, {
        method: "POST",
        headers: { "x-admin-token": adminToken, "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ extraInstructions: heroPrompt || undefined })
      });
      if (res.ok) {
        setHeroPrompt("");
        loadAssets(activeSlug);
      } else {
        const err = await res.json();
        alert("Error: " + err.error);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setBusy(false);
    }
  }

  async function handleUpload() {
    if (!fileToUpload || !activeSlug) return;
    
    setBusy(true);
    try {
      const reader = new FileReader();
      reader.onload = async () => {
        const result = reader.result as string;
        const b64 = result.split(",")[1];
        
        const res = await fetch(`${API_BASE}/menu/items/${activeSlug}/assets/upload`, {
          method: "POST",
          headers: { "x-admin-token": adminToken, "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({
            dataBase64: b64,
            mimeType: fileToUpload.type
          })
        });
        
        if (res.ok) {
          setFileToUpload(null);
          loadAssets(activeSlug);
        } else {
          const err = await res.json();
          alert("Error: " + err.error);
        }
        setBusy(false);
      };
      reader.readAsDataURL(fileToUpload);
    } catch (err) {
      console.error(err);
      setBusy(false);
    }
  }

  async function handleBulkHero() {
    if (missingItems.length === 0) return;
    
    setBulkBusy(true);
    setBulkProgress([]);
    try {
      const slugs = missingItems.map(m => m.slug).slice(0, 10); // using 10 as cap for demo
      const res = await fetch(`${API_BASE}/menu/items/assets/bulk-hero`, {
        method: "POST",
        headers: { "x-admin-token": adminToken, "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ slugs, confirm: true })
      });
      
      if (!res.ok) {
        const err = await res.json();
        alert("Error: " + err.error);
        setBulkBusy(false);
        return;
      }
      
      const reader = res.body?.getReader();
      const decoder = new TextDecoder();
      
      if (reader) {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          
          const chunk = decoder.decode(value, { stream: true });
          const lines = chunk.split("\n").filter(l => l.trim());
          
          for (const line of lines) {
            try {
              const obj = JSON.parse(line);
              if (obj.ok) {
                setBulkProgress(prev => [...prev, `✅ Generated hero for ${obj.slug}`]);
              } else {
                setBulkProgress(prev => [...prev, `❌ Failed for ${obj.slug}: ${obj.error}`]);
              }
            } catch (e) {
              // partial line or parsing error
            }
          }
        }
      }
      
      loadMissing();
    } catch (err) {
      console.error(err);
    } finally {
      setBulkBusy(false);
    }
  }

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Menu Imagery</h1>
          <p className="text-zinc-500">Manage dish assets, AI generation, and primary images.</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card className="col-span-1">
          <CardHeader>
            <CardTitle>Look up SKU</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex gap-2">
              <Input 
                placeholder="Enter slug..." 
                value={slugSearch}
                onChange={e => setSlugSearch(e.target.value)}
              />
              <Button onClick={() => loadAssets(slugSearch)} disabled={busy || !slugSearch}>Load</Button>
            </div>
            
            <hr className="my-4" />
            
            <div>
              <h3 className="font-medium mb-2">Missing Primary Image ({missingItems.length})</h3>
              {missingItems.length > 0 ? (
                <>
                  <div className="max-h-60 overflow-y-auto space-y-2 border rounded p-2 mb-4">
                    {missingItems.map(m => (
                      <div 
                        key={m.slug} 
                        className="text-sm p-2 hover:bg-zinc-100 cursor-pointer rounded flex justify-between items-center"
                        onClick={() => loadAssets(m.slug)}
                      >
                        <span className="truncate" title={m.name}>{m.name}</span>
                        <span className="text-zinc-400 text-xs">{m.slug}</span>
                      </div>
                    ))}
                  </div>
                  <Button 
                    className="w-full" 
                    onClick={handleBulkHero} 
                    disabled={bulkBusy}
                  >
                    {bulkBusy ? "Generating..." : `Bulk Generate Heroes (${Math.min(missingItems.length, 10)})`}
                  </Button>
                  
                  {bulkProgress.length > 0 && (
                    <div className="mt-4 max-h-32 overflow-y-auto text-xs font-mono bg-zinc-950 text-emerald-400 p-2 rounded">
                      {bulkProgress.map((p, i) => <div key={i}>{p}</div>)}
                    </div>
                  )}
                </>
              ) : (
                <p className="text-sm text-zinc-500">All items have images!</p>
              )}
            </div>
          </CardContent>
        </Card>

        <Card className="col-span-1 md:col-span-2">
          <CardHeader>
            <CardTitle>{activeSlug ? `Assets for ${activeSlug}` : "No item selected"}</CardTitle>
          </CardHeader>
          <CardContent>
            {!activeSlug ? (
              <div className="text-center p-8 text-zinc-500 border border-dashed rounded">
                Search for a slug or select from the missing list.
              </div>
            ) : (
              <div className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {assets.map(asset => (
                    <div key={asset.id} className={`border rounded-lg overflow-hidden ${asset.isPrimary ? 'ring-2 ring-emerald-500' : ''}`}>
                      <div className="h-40 bg-zinc-100 relative">
                        <img 
                          src={asset.publicUrl.startsWith('http') ? asset.publicUrl : `${API_BASE}${asset.publicUrl}`} 
                          alt={asset.slug}
                          className="w-full h-full object-cover"
                        />
                        {asset.isPrimary && (
                          <Badge className="absolute top-2 right-2 bg-emerald-500 text-white border-0">Primary</Badge>
                        )}
                      </div>
                      <div className="p-3 space-y-3 bg-white">
                        <div className="flex justify-between items-start">
                          <span className="font-mono text-xs">{asset.kind}</span>
                          {asset.isAiGenerated && <Badge variant="outline" className="text-xs py-0 h-5">AI</Badge>}
                        </div>
                        
                        <div className="grid grid-cols-2 gap-2">
                          <Button 
                            variant="outline" 
                            size="sm" 
                            className="w-full text-xs h-7 px-2"
                            disabled={asset.isPrimary || busy}
                            onClick={() => handleAssetAction(asset.id, "set-primary")}
                          >
                            Set Primary
                          </Button>
                          <Button 
                            variant="outline" 
                            size="sm" 
                            className="w-full text-xs h-7 px-2 text-rose-600 hover:text-rose-700"
                            disabled={asset.kind === "original" || busy}
                            onClick={() => handleAssetAction(asset.id, "delete")}
                          >
                            Delete
                          </Button>
                          <Button 
                            variant="outline" 
                            size="sm" 
                            className="w-full text-xs h-7 px-2"
                            disabled={busy}
                            onClick={() => handleAssetAction(asset.id, "enhance")}
                          >
                            Enhance
                          </Button>
                          <Button 
                            variant="outline" 
                            size="sm" 
                            className="w-full text-xs h-7 px-2"
                            disabled={busy}
                            onClick={() => handleAssetAction(asset.id, "remove-bg")}
                          >
                            Remove BG
                          </Button>
                        </div>
                      </div>
                    </div>
                  ))}
                  {assets.length === 0 && !busy && (
                    <div className="col-span-full p-8 text-center text-zinc-500 border border-dashed rounded">
                      No assets found for this item.
                    </div>
                  )}
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-4 border-t">
                  <div className="space-y-3">
                    <h3 className="font-medium">Upload Image</h3>
                    <div className="flex gap-2">
                      <Input 
                        type="file" 
                        accept="image/jpeg,image/png,image/webp" 
                        onChange={(e) => setFileToUpload(e.target.files?.[0] || null)}
                      />
                      <Button onClick={handleUpload} disabled={!fileToUpload || busy}>Upload</Button>
                    </div>
                  </div>
                  
                  <div className="space-y-3">
                    <h3 className="font-medium">Generate AI Hero</h3>
                    <div className="flex gap-2">
                      <Input 
                        placeholder="Extra instructions (e.g. 'wooden table')"
                        value={heroPrompt}
                        onChange={e => setHeroPrompt(e.target.value)}
                      />
                      <Button onClick={handleGenerateHero} disabled={busy}>Generate</Button>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
