"use client";

import { useRouter } from "next/navigation";
import { switchProject } from "@/app/(app)/project-actions";

// Switches the active project (cookie) then navigates — used by the portfolio
// rollup to drill into a specific project's dashboard.
export function ProjectLink({
  projectId,
  href = "/dashboard",
  className,
  children,
}: {
  projectId: string;
  href?: string;
  className?: string;
  children: React.ReactNode;
}) {
  const router = useRouter();
  return (
    <button
      type="button"
      className={className}
      onClick={async () => {
        await switchProject(projectId);
        router.push(href);
      }}
    >
      {children}
    </button>
  );
}
