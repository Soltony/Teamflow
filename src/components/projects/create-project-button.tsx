
'use client';

import { useAuth } from "@/context/auth-context";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { PlusCircle } from "lucide-react";

export function CreateProjectButton() {
    const { hasPermission } = useAuth();

    if (!hasPermission('projects:create')) {
        return null;
    }

    return (
        <Button asChild>
            <Link href="/projects/new">
                <PlusCircle className="w-4 h-4 mr-2" />
                Create Project
            </Link>
        </Button>
    );
}
