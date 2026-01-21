"use client";

import { usePathname, useSearchParams } from "next/navigation";
import { useMemo } from "react";
import BottomNavbar from "./BottomNavbar";

export default function NavbarWrapper() {
    const pathname = usePathname();
    const searchParams = useSearchParams();

    const shouldHideNavbar = useMemo(() => {
        const hideNavbarPaths = [
            "/login",
            "/signup",
            "/onboarding",
            "/welcome",
            "/auth/setup",
            "/auth",
            "/fullscreen",
            "/tod",
            "/", // Hide on root page
        ];

        const isExactMatch = hideNavbarPaths.includes(pathname);

        // Prefix checks for dynamic routes or sub-folders
        const isPrefixMatch =
            pathname.startsWith("/confess/") ||
            pathname.startsWith("/auth/") ||
            pathname.startsWith("/tod/") ||
            pathname.startsWith("/anonymous/");

        // Check if modal=dykm is present in query params
        const isDykmModalOpen = searchParams.get('modal') === 'dykm';

        return isExactMatch || isPrefixMatch || isDykmModalOpen;
    }, [pathname, searchParams]);

    if (shouldHideNavbar) return null;

    return <BottomNavbar />;
}
