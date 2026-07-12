import { Link, useNavigate } from "react-router";
import { usePreferences } from "@/lib/preferencesContext";
import {
  preferencesApi,
  MEDICAL_CONDITION_LABEL,
  type ClinicalContraindication,
} from "@/lib/preferencesApi";
import { toast } from "sonner";
import { useState } from "react";

export default function HealthInformation() {
  const { preferences, loading, refresh } = usePreferences();
  const navigate = useNavigate();
  const [removingField, setRemovingField] = useState<string | null>(null);
  const [deletingAccount, setDeletingAccount] = useState(false);

  if (loading) {
    return (
      <div className="tnm2" style={{ minHeight: "100vh", background: "var(--bg)" }}>
        <div style={{ maxWidth: 480, margin: "0 auto" }}>
          <div className="appbar">
            <Link className="iconbtn" to="/account" aria-label="Account">
              <i className="ph-bold ph-arrow-left" />
            </Link>
            <div className="abt">Health & Clinical Info</div>
          </div>
          <div className="content padx" style={{ paddingTop: 4 }}>
            <div className="skel" style={{ height: 28, width: 200 }} />
            <div className="skel mt10" style={{ height: 14, width: 260 }} />
            <div className="card mt16">
              <div className="skel" style={{ height: 50, width: "100%" }} />
            </div>
          </div>
        </div>
      </div>
    );
  }

  const handleRemoveField = async (field: string, condition?: string) => {
    const key = condition ? `${field}-${condition}` : field;
    setRemovingField(key);
    try {
      const res = await preferencesApi.deleteHealthField(field, condition);
      if (res.success) {
        toast.success(res.message);
        await refresh();
      } else {
        toast.error("Could not remove health field");
      }
    } catch (err: any) {
      toast.error(err.message || "Failed to remove health field");
    } finally {
      setRemovingField(null);
    }
  };

  const handleDeleteAccount = async () => {
    if (!window.confirm("Are you sure you want to delete your account? This action is permanent, and under the DPDP Act 2023 all your personal and health data will be completely erased from our servers.")) {
      return;
    }
    setDeletingAccount(true);
    try {
      const res = await preferencesApi.deleteAccount();
      if (res.success) {
        toast.success("Account successfully deleted and all associated data permanently erased.");
        navigate("/");
        window.location.reload();
      } else {
        toast.error("Failed to delete account");
      }
    } catch (err: any) {
      toast.error(err.message || "Failed to delete account");
    } finally {
      setDeletingAccount(false);
    }
  };

  const hasPreferences = !!preferences;
  const hba1c = preferences?.hba1cPct;
  const pcos = preferences?.pcosHistory;
  const height = preferences?.heightCm;
  const weight = preferences?.weightKg;
  const medicalConditions = preferences?.medicalConditions || [];

  return (
    <div className="tnm2" style={{ minHeight: "100vh", background: "var(--bg)" }}>
      <div style={{ maxWidth: 480, margin: "0 auto" }}>
        <div className="appbar">
          <Link className="iconbtn" to="/account" aria-label="Account">
            <i className="ph-bold ph-arrow-left" />
          </Link>
          <div className="abt">Health Information</div>
        </div>

        <div className="content padx" style={{ paddingBottom: 40 }}>
          <div style={{ paddingTop: 4 }}>
            <div className="lab" style={{ color: "var(--safb)", display: "flex", alignItems: "center", gap: 6 }}>
              <i className="ph-bold ph-shield-check" />
              DPDP Compliance & Privacy
            </div>
            <h1 className="disp mt6" style={{ color: "var(--text-primary)" }}>
              Health & Clinical Information
            </h1>
            <p className="small mut mt6">
              Your clinical profile is used to personalize dish ranking. Under DPDP Act 2023, you can choose to remove any of this information at any time.
            </p>
          </div>

          <div className="fx col gap12 mt16">
            {/* HbA1c Level */}
            <div className="card fx ac jb gap12">
              <div>
                <div className="lab">HbA1c Level</div>
                <div className="small fw6 mt2">
                  {hba1c !== null && hba1c !== undefined ? `${hba1c}%` : "Not provided"}
                </div>
              </div>
              {hba1c !== null && hba1c !== undefined && (
                <button
                  type="button"
                  className="btn btn-g"
                  style={{ flex: "none" }}
                  disabled={removingField !== null}
                  onClick={() => handleRemoveField("hba1cPct")}
                >
                  {removingField === "hba1cPct" ? "Removing..." : "Remove"}
                </button>
              )}
            </div>

            {/* PCOS History */}
            <div className="card fx ac jb gap12">
              <div>
                <div className="lab">PCOS History</div>
                <div className="small fw6 mt2">
                  {pcos !== null && pcos !== undefined ? (pcos ? "Yes" : "No") : "Not provided"}
                </div>
              </div>
              {pcos !== null && pcos !== undefined && (
                <button
                  type="button"
                  className="btn btn-g"
                  style={{ flex: "none" }}
                  disabled={removingField !== null}
                  onClick={() => handleRemoveField("pcosHistory")}
                >
                  {removingField === "pcosHistory" ? "Removing..." : "Remove"}
                </button>
              )}
            </div>

            {/* Height */}
            <div className="card fx ac jb gap12">
              <div>
                <div className="lab">Height</div>
                <div className="small fw6 mt2">
                  {height ? `${height} cm` : "Not provided"}
                </div>
              </div>
              {height !== null && height !== undefined && (
                <button
                  type="button"
                  className="btn btn-g"
                  style={{ flex: "none" }}
                  disabled={removingField !== null}
                  onClick={() => handleRemoveField("heightCm")}
                >
                  {removingField === "heightCm" ? "Removing..." : "Remove"}
                </button>
              )}
            </div>

            {/* Weight */}
            <div className="card fx ac jb gap12">
              <div>
                <div className="lab">Weight</div>
                <div className="small fw6 mt2">
                  {weight ? `${weight} kg` : "Not provided"}
                </div>
              </div>
              {weight !== null && weight !== undefined && (
                <button
                  type="button"
                  className="btn btn-g"
                  style={{ flex: "none" }}
                  disabled={removingField !== null}
                  onClick={() => handleRemoveField("weightKg")}
                >
                  {removingField === "weightKg" ? "Removing..." : "Remove"}
                </button>
              )}
            </div>

            {/* Medical Conditions */}
            <div className="card">
              <div className="lab mb10">Medical Conditions</div>
              {medicalConditions.length === 0 ? (
                <div className="fine mut">No conditions registered.</div>
              ) : (
                <div className="fx col gap8 mt6">
                  {medicalConditions.map((cond) => {
                    const label = MEDICAL_CONDITION_LABEL[cond as ClinicalContraindication] || cond;
                    const key = `medicalConditions-${cond}`;
                    return (
                      <div key={cond} className="fx ac jb gap12 p8 rounded" style={{ background: "var(--s1)", border: "1px solid var(--ln)" }}>
                        <span className="small fw6">{label}</span>
                        <button
                          type="button"
                          className="btn btn-g"
                          style={{ padding: "4px 8px", fontSize: 12, flex: "none" }}
                          disabled={removingField !== null}
                          onClick={() => handleRemoveField("medicalConditions", cond)}
                        >
                          {removingField === key ? "Removing..." : "Remove"}
                        </button>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* DPDP Section: Right to be Forgotten / Delete Account */}
            <div className="card mt16" style={{ borderColor: "var(--color-error)" }}>
              <div className="fx ac gap8 errorc mb8" style={{ color: "var(--color-error)" }}>
                <i className="ph-fill ph-warning" />
                <span className="tt">Right to Erasure (Section 12)</span>
              </div>
              <p className="fine leading-relaxed">
                Under the Digital Personal Data Protection Act (DPDPA) 2023, you have the right to request erasure of your entire account and all associated personal, health, and dietary history.
              </p>
              <div className="mt12 pt12" style={{ borderTop: "1px solid var(--ln)" }}>
                <button
                  type="button"
                  className="btn"
                  style={{
                    width: "100%",
                    justifyContent: "center",
                    background: "color-mix(in oklab, var(--color-error) 10%, transparent)",
                    borderColor: "var(--color-error)",
                    color: "var(--color-error)",
                  }}
                  disabled={deletingAccount || !hasPreferences}
                  onClick={handleDeleteAccount}
                >
                  {deletingAccount ? "Deleting Account..." : "Permanently Delete Account & Data"}
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
