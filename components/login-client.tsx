"use client";

import { useEffect, useState } from "react";
import { getClientAuthState, login } from "@/lib/client-auth";

export function LoginClient() {
  const [message, setMessage] = useState("Checking sign-in status...");

  useEffect(() => {
    void getClientAuthState().then((state) => {
      if (state.status === "authenticated") {
        window.location.href = "/";
        return;
      }
      if (state.status === "misconfigured") {
        setMessage(state.error ?? "Authentication is not configured.");
        return;
      }
      setMessage("Sign in with your COSTAATT Microsoft account.");
    });
  }, []);

  return (
    <>
      <p>{message}</p>
      <button className="button" onClick={() => void login()}>
        Sign in with Microsoft
      </button>
    </>
  );
}
