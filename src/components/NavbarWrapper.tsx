"use client";

import { usePathname } from "next/navigation";
import { useMemo } from "react";
import BottomNavbar from "./BottomNavbar";

export default function NavbarWrapper() {
    const pathname = usePathname();

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
            pathname.startsWith("/anonymous/") ||
            pathname.startsWith("/messages/");

        return isExactMatch || isPrefixMatch;
    }, [pathname]);

    if (shouldHideNavbar) return null;

    return <BottomNavbar />;
}
