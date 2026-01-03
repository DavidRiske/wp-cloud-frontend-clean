"use client";

import { useEffect, useMemo, useState } from "react";

const API_BASE = "https://func-apkevq.azurewebsites.net/api";

type FileItem = { key: string; size?: number; last_modified?: string };

function readSessionJson<T>(key: string): T | null {
  try {
    if (typeof window === "undefined") return null;
    const raw = sessionStorage.getItem(key);
    if (!raw) return null;
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

export default function AppPage() {
  const [files, setFiles] = useState<FileItem[]>([]);
  const [selectedKey, setSelectedKey] = useState<string>("");
  const [previewUrl, setPreviewUrl] = useState<string>("");
  const [tags, setTags] = useState<string[]>([]);
  const [error, setError] = useState<string>("");

  const token =
    typeof window !== "undefined"
      ? sessionStorage.getItem("wpcloud_token")
      : null;

  const user = useMemo(() => {
    return readSessionJson<{ email?: string; user_id?: string; display_name?: string }>(
      "wpcloud_user",
    );
  }, []);

  const userId = user?.email || user?.user_id || "";

  useEffect(() => {
    // nicht eingeloggt -> zurück
    if (!token) {
      window.location.href = "/login";
      return;
    }

    // falls userId fehlt (weil wpcloud_user nicht gespeichert wurde) -> zurück
    if (!userId) {
      setError("User not found in session. Please login again.");
      return;
    }

    loadFiles();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function loadFiles() {
    setError("");
    try {
      const res = await fetch(`${API_BASE}/files?userId=${encodeURIComponent(userId)}`, {
        method: "GET",
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });

      const data = await res.json().catch(() => ({} as any));
      if (!res.ok) throw new Error(data?.error || `HTTP ${res.status}`);

      // ✅ Frontend-Filter: nur Dateien von diesem User (prefix "userId/")
      const all: FileItem[] = data.files || [];
      const mine = all.filter((f) => typeof f.key === "string" && f.key.startsWith(`${userId}/`));

      setFiles(mine);
    } catch (e: any) {
      setError(e.message || "Load files failed");
    }
  }

  async function upload(file: File) {
    setError("");
    setTags([]);
    setPreviewUrl("");
    try {
      if (!userId) throw new Error("No userId in session (please login again).");

      // 1) SAS holen (Backend baut key = `${userId}/${fileName}`)
      const sasRes = await fetch(`${API_BASE}/files/sas`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ fileName: file.name })
      });

      const sas = await sasRes.json().catch(() => ({} as any));
      if (!sasRes.ok) throw new Error(sas?.error || `SAS HTTP ${sasRes.status}`);

      // 2) PUT direkt in Blob
      const put = await fetch(sas.uploadUrl, {
        method: "PUT",
        headers: {
          "x-ms-blob-type": "BlockBlob",
          "Content-Type": file.type || "application/octet-stream",
        },
        body: file,
      });

      if (!put.ok) {
        const t = await put.text().catch(() => "");
        throw new Error(`Blob upload failed: HTTP ${put.status} ${t}`);
      }

      setSelectedKey(sas.objectKey);
      setPreviewUrl(URL.createObjectURL(file));

      await loadFiles();
    } catch (e: any) {
      setError(e.message || "Upload failed");
    }
  }

  async function analyze(key: string) {
    setError("");
    try {
      // kleine Sicherheit: nur eigene Keys analysieren (Frontend)
      if (userId && !key.startsWith(`${userId}/`)) {
        throw new Error("Not your file.");
      }

      const res = await fetch(`${API_BASE}/files/analyze`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
       body: JSON.stringify({ key }),

      });

      const data = await res.json().catch(() => ({} as any));
      if (!res.ok) throw new Error(data?.error || `HTTP ${res.status}`);

      const values = data?.analysis?.tagsResult?.values || [];
      const extracted = values.map((v: any) => v?.name).filter(Boolean);
      setTags(extracted);
    } catch (e: any) {
      setError(e.message || "Analyze failed");
    }
  }

  function logout() {
    sessionStorage.removeItem("wpcloud_token");
    sessionStorage.removeItem("wpcloud_user");
    window.location.href = "/login";
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 p-6">
      <div className="mx-auto max-w-5xl space-y-6">
        <header className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-semibold">WP Cloud – Vault</h1>
            <p className="text-sm text-slate-400">
              Logged in as: <span className="text-emerald-300">{userId || "—"}</span>
            </p>
          </div>

          <button
            onClick={logout}
            className="rounded-full bg-slate-800 px-4 py-2 text-sm hover:bg-slate-700"
          >
            Logout
          </button>
        </header>

        {error && (
          <div className="rounded-xl border border-red-400/40 bg-red-500/10 px-4 py-3 text-sm text-red-300">
            {error}
          </div>
        )}

        <div className="rounded-3xl border border-white/10 bg-slate-900/70 p-6">
          <h2 className="mb-3 text-lg font-semibold">Upload</h2>
          <input
            type="file"
            accept="image/*"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) upload(f);
            }}
            className="block w-full text-sm"
          />
          <p className="mt-3 text-sm text-slate-400">
            Flow: SAS holen → PUT direkt ins Blob → Files anzeigen → Analyze
          </p>
        </div>

        <div className="grid gap-6 md:grid-cols-2">
          <div className="rounded-3xl border border-white/10 bg-slate-900/70 p-6">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-lg font-semibold">Files (nur deine)</h2>
              <button
                onClick={loadFiles}
                className="rounded-full bg-slate-800 px-4 py-2 text-sm hover:bg-slate-700"
              >
                Refresh
              </button>
            </div>

            <div className="space-y-2">
              {files.map((f) => (
                <div
                  key={f.key}
                  className="flex items-center justify-between gap-3 rounded-xl border border-white/10 bg-slate-950/40 px-3 py-2"
                >
                  <button
                    className="text-left text-sm underline text-emerald-300 hover:text-emerald-200"
                    onClick={() => {
                      setSelectedKey(f.key);
                      setTags([]);
                      setPreviewUrl("");
                    }}
                  >
                    {f.key}
                  </button>

                  <button
                    className="rounded-full bg-emerald-500 px-4 py-2 text-xs font-semibold text-slate-950 hover:bg-emerald-400"
                    onClick={() => analyze(f.key)}
                  >
                    Analyze
                  </button>
                </div>
              ))}

              {files.length === 0 && (
                <p className="text-sm text-slate-400">
                  Noch keine Dateien für <span className="text-emerald-300">{userId}</span>.
                </p>
              )}
            </div>
          </div>

          <div className="rounded-3xl border border-white/10 bg-slate-900/70 p-6">
            <h2 className="mb-3 text-lg font-semibold">Preview & Tags</h2>

            {previewUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={previewUrl}
                alt="preview"
                className="max-h-80 rounded-2xl border border-white/10"
              />
            ) : (
              <p className="text-sm text-slate-400">
                Upload ein Bild, dann siehst du hier die Preview.
              </p>
            )}

            <div className="mt-4 text-sm">
              <div>
                <span className="font-semibold">Selected:</span> {selectedKey || "—"}
              </div>

              {tags.length > 0 && (
                <div className="mt-3">
                  <div className="font-semibold">Tags:</div>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {tags.map((t) => (
                      <span
                        key={t}
                        className="rounded-full border border-white/10 bg-slate-950/50 px-3 py-1 text-xs"
                      >
                        {t}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {selectedKey && (
              <button
                onClick={() => analyze(selectedKey)}
                className="mt-4 w-full rounded-full bg-emerald-500 px-4 py-3 text-sm font-semibold text-slate-950 hover:bg-emerald-400"
              >
                Analyze selected
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
