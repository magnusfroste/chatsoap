import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";

interface AppSettings {
  requireInviteCode: boolean;
  loading: boolean;
}

export function useAppSettings(): AppSettings {
  const [requireInviteCode, setRequireInviteCode] = useState(true);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchSettings();
  }, []);

  const fetchSettings = async () => {
    const { data } = await supabase
      .from("app_settings")
      .select("*")
      .eq("key", "require_invite_code")
      .single();

    if (data) {
      setRequireInviteCode(data.value === true);
    }
    setLoading(false);
  };

  return { requireInviteCode, loading };
}
