import type { ReactNode } from "react";

import { usePermission } from "@/lib/auth";
import type { Permission } from "@/lib/permissions";

/** Render children only if the current staff member has `permission`. */
export function Can({
  permission,
  children,
  fallback = null,
}: {
  permission: Permission;
  children: ReactNode;
  fallback?: ReactNode;
}) {
  return usePermission(permission) ? <>{children}</> : <>{fallback}</>;
}
