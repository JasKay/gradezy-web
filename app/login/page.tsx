"use client";

import Link from "next/link";
import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!email.trim() || !password.trim()) return setError("Enter your email and password to continue.");
    localStorage.setItem("gradezy_session", JSON.stringify({ email: email.trim(), signedInAt: new Date().toISOString() }));
    router.push("/dashboard");
  }

  return <main className="flex min-h-screen items-center justify-center bg-[#070b12] px-6 text-white"><div className="w-full max-w-md"><Link href="/" className="mb-10 flex items-center justify-center gap-3"><span className="flex h-10 w-10 items-center justify-center rounded-xl bg-white font-black text-[#070b12]">G</span><span className="text-2xl font-semibold">Gradezy</span></Link><div className="rounded-3xl border border-white/10 bg-[#0d131d] p-7 shadow-2xl shadow-black/20 sm:p-9"><p className="text-sm font-semibold uppercase tracking-[0.18em] text-indigo-300">Workspace access</p><h1 className="mt-4 text-3xl font-semibold tracking-[-0.03em]">Sign in to Gradezy</h1><p className="mt-3 text-sm leading-6 text-slate-400">Use any email and password for this MVP workspace.</p><form onSubmit={submit} className="mt-8 space-y-5"><label className="block text-sm font-medium text-slate-300">Email<input value={email} onChange={(event) => setEmail(event.target.value)} type="email" autoComplete="email" className="mt-2 w-full rounded-xl border border-white/10 bg-white/[0.04] px-4 py-3 text-white outline-none placeholder:text-slate-600 focus:border-indigo-400" placeholder="you@college.ac.uk" /></label><label className="block text-sm font-medium text-slate-300">Password<input value={password} onChange={(event) => setPassword(event.target.value)} type="password" autoComplete="current-password" className="mt-2 w-full rounded-xl border border-white/10 bg-white/[0.04] px-4 py-3 text-white outline-none placeholder:text-slate-600 focus:border-indigo-400" placeholder="Enter any password" /></label>{error && <p className="text-sm text-red-300">{error}</p>}<button className="w-full rounded-xl bg-white px-5 py-3 text-sm font-semibold text-[#070b12] hover:bg-slate-200">Sign in to workspace →</button></form></div></div></main>;
}
