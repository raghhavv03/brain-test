"use client";

import { useEffect } from "react";
import { ensureSession } from "@/lib/supabase/session";

export function SessionBootstrap() {
  useEffect(() => {
    ensureSession().catch((error) => {
      console.error("Failed to establish session:", error);
    });
  }, []);

  return null;
}
