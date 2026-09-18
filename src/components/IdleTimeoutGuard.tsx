import { useRef } from "react";

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { clearIdleActivity, useIdleTimeout } from "@/hooks/use-idle-timeout";
import { supabase } from "@/integrations/supabase/client";

export function IdleTimeoutGuard() {
  const signingOut = useRef(false);

  const { warning, secondsLeft, stayActive } = useIdleTimeout({
    onTimeout: () => {
      if (signingOut.current) return;
      signingOut.current = true;
      clearIdleActivity();
      void supabase.auth
        .signOut()
        .catch(() => undefined)
        .finally(() => {
          window.location.assign("/auth?reason=timeout");
        });
    },
  });

  return (
    <AlertDialog open={warning}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Still there?</AlertDialogTitle>
          <AlertDialogDescription>
            You'll be signed out in {secondsLeft} second{secondsLeft === 1 ? "" : "s"} because of
            inactivity.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogAction onClick={stayActive}>Stay signed in</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
